import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { TenantService } from '../../../core/tenant/tenant';
import { MyNutritionService, latestCheckin } from './my-nutrition.service';
import type { DailyNutritionLogDto, MetricEntryDto } from '../client-nutrition/nutrition-log.model';
import type { FoodDto } from '../nutrition-plans/food.model';

function todayLog(): DailyNutritionLogDto {
  return {
    id: 'log1',
    traineeId: 't1',
    localDate: '2026-06-12',
    status: 'open',
    source: 'plan',
    hasPlan: true,
    adherencePct: 0,
    plannedCount: 1,
    completedCount: 0,
    meals: [
      {
        name: 'Breakfast',
        scheduledTime: '08:00:00',
        items: [
          {
            id: 'item-1',
            planMealItemId: 'pmi-1',
            isPlanned: true,
            foodId: 'f1',
            kind: 'food',
            foodName: 'Oats',
            servingLabel: '1 bowl',
            quantity: 1,
            energyKcal: 200,
            proteinG: 8,
            carbsG: 30,
            fatG: 4,
            fiberG: 5,
            status: 'planned',
            loggedAtUtc: null,
            note: null
          }
        ]
      }
    ]
  };
}

const food: FoodDto = {
  id: 'f9',
  name: 'Banana',
  brand: null,
  kind: 'food',
  servingLabel: '1 medium',
  servingSizeGrams: 118,
  energyKcal: 105,
  proteinG: 1,
  carbsG: 27,
  fatG: 0,
  fiberG: 3,
  isCustom: false
};

describe('MyNutritionService', () => {
  let service: MyNutritionService;
  let http: HttpTestingController;
  let tenant: TenantService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(MyNutritionService);
    http = TestBed.inject(HttpTestingController);
    tenant = TestBed.inject(TenantService);
    tenant.activeTenantId.set('gym-1');
  });

  afterEach(() => http.verify());

  /** Let queued microtasks settle so a chained refetch (reloadTodaySilently) gets dispatched. */
  const flushMicrotasks = async (): Promise<void> => {
    await Promise.resolve();
    await Promise.resolve();
  };

  /** Load Today into the service so writes have a date + current state to scope to. */
  function primeToday(): void {
    service.loadToday();
    const req = http.expectOne((r) => r.url === '/api/me/nutrition/today');
    expect(req.request.params.get('timezone')).toBeTruthy();
    req.flush(todayLog());
  }

  it('loads today self-scoped with a timezone param', () => {
    primeToday();
    expect(service.today()?.localDate).toBe('2026-06-12');
    expect(service.todayLoading()).toBeFalse();
  });

  it('loads history against /days and stores the items', () => {
    service.loadHistory({ from: '2026-06-01', to: '2026-06-12', pageSize: 30 });
    const req = http.expectOne((r) => r.url === '/api/me/nutrition/days');
    expect(req.request.params.get('from')).toBe('2026-06-01');
    expect(req.request.params.get('pageSize')).toBe('30');
    req.flush({
      items: [
        {
          id: 'd1',
          traineeId: 't1',
          localDate: '2026-06-11',
          status: 'closed',
          source: 'plan',
          adherencePct: 80,
          plannedCount: 5,
          completedCount: 4
        }
      ],
      page: 1,
      pageSize: 30,
      totalCount: 1
    });
    expect(service.historyDays().length).toBe(1);
    expect(service.historyDays()[0].adherencePct).toBe(80);
  });

  it('sets item status optimistically and posts the wire status', async () => {
    primeToday();
    const promise = service.setStatus('item-1', 'completed');
    // Optimistic: ring/state updated before the network resolves.
    expect(service.today()?.completedCount).toBe(1);

    const req = http.expectOne('/api/nutrition/log/items/status');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ date: '2026-06-12', itemId: 'item-1', status: 'completed' });
    req.flush({});
    await promise;
  });

  it('rolls back the optimistic status change when the write fails', async () => {
    primeToday();
    const before = service.today();
    const promise = service.setStatus('item-1', 'completed');
    const req = http.expectOne('/api/nutrition/log/items/status');
    req.flush('nope', { status: 500, statusText: 'Server Error' });
    await expectAsync(promise).toBeRejected();
    expect(service.today()).toEqual(before);
  });

  it('un-completing a planned item sends skipped on the wire', async () => {
    primeToday();
    const promise = service.setStatus('item-1', 'planned');
    const req = http.expectOne('/api/nutrition/log/items/status');
    expect(req.request.body.status).toBe('skipped');
    req.flush({});
    await promise;
  });

  it('substitutes a planned item with the catalog food id + quantity', async () => {
    primeToday();
    const promise = service.substitute('item-1', food, 2);
    const req = http.expectOne('/api/nutrition/log/items/substitute');
    expect(req.request.body).toEqual({ date: '2026-06-12', itemId: 'item-1', foodId: 'f9', quantity: 2 });
    req.flush({});
    await promise;
    expect(service.today()?.meals[0].items[0].status).toBe('substituted');
  });

  it('adds an off-plan catalog food then reconciles with a silent refetch', async () => {
    primeToday();
    const promise = service.addOffPlan(food, 1, 'Snack');
    const post = http.expectOne('/api/nutrition/log/items');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ date: '2026-06-12', foodId: 'f9', quantity: 1, mealName: 'Snack' });
    post.flush('new-item-id');
    await flushMicrotasks();
    // Reconcile refetch of Today.
    const refetch = http.expectOne((r) => r.url === '/api/me/nutrition/today');
    refetch.flush(todayLog());
    await promise;
  });

  it('adds a custom off-plan food with the inline snapshot fields', async () => {
    primeToday();
    const custom: FoodDto = { ...food, id: 'should-be-dropped', isCustom: true, name: 'Homemade bar' };
    const promise = service.addOffPlan(custom, 1);
    const post = http.expectOne('/api/nutrition/log/items');
    expect(post.request.body.foodId).toBeUndefined();
    expect(post.request.body.customName).toBe('Homemade bar');
    expect(post.request.body.mealName).toBe('Off-plan');
    post.flush('id');
    await flushMicrotasks();
    http.expectOne((r) => r.url === '/api/me/nutrition/today').flush(todayLog());
    await promise;
  });

  it('logs a custom off-plan food under the chosen meal slot (inline snapshot + mealName)', async () => {
    primeToday();
    const custom: FoodDto = { ...food, isCustom: true, name: 'Trail mix' };
    const promise = service.addOffPlan(custom, 2, 'Snack');
    const post = http.expectOne('/api/nutrition/log/items');
    expect(post.request.body.foodId).toBeUndefined();
    expect(post.request.body.customName).toBe('Trail mix');
    expect(post.request.body.quantity).toBe(2);
    expect(post.request.body.mealName).toBe('Snack');
    post.flush('id');
    await flushMicrotasks();
    http.expectOne((r) => r.url === '/api/me/nutrition/today').flush(todayLog());
    await promise;
  });

  it('removes an ad-hoc item via DELETE with the date query param', async () => {
    primeToday();
    const promise = service.removeItem('item-1');
    const req = http.expectOne((r) => r.url === '/api/nutrition/log/items/item-1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.params.get('date')).toBe('2026-06-12');
    req.flush(null);
    await promise;
  });

  it('throws (no network) when no gym is active for an item write', async () => {
    primeToday();
    tenant.activeTenantId.set(null);
    await expectAsync(service.setStatus('item-1', 'completed')).toBeRejectedWithError(/gym/i);
    // No write went out.
    http.expectNone('/api/nutrition/log/items/status');
  });

  it('logs a weight metric self-scoped and updates the check-in', async () => {
    const promise = service.logWeight(78.5);
    expect(service.checkin().weightKg).toBe(78.5);
    const req = http.expectOne('/api/me/nutrition/metrics');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ type: 'weight', value: 78.5, unit: 'kg' });
    req.flush({ logged: true });
    await promise;
  });

  it('rolls back a metric write on failure', async () => {
    const promise = service.logSleep(7.5);
    expect(service.checkin().sleepHours).toBe(7.5);
    const req = http.expectOne('/api/me/nutrition/metrics');
    req.flush('boom', { status: 500, statusText: 'Server Error' });
    await expectAsync(promise).toBeRejected();
    expect(service.checkin().sleepHours).toBeNull();
  });

  it('loads the latest check-in from the newest-first metric series', () => {
    service.loadCheckin();
    const req = http.expectOne((r) => r.url === '/api/me/nutrition/metrics');
    req.flush({
      items: [
        { type: 'weight', value: 79, unit: 'kg', localDate: '2026-06-12', loggedAtUtc: '2026-06-12T08:00:00Z' },
        { type: 'weight', value: 80, unit: 'kg', localDate: '2026-06-11', loggedAtUtc: '2026-06-11T08:00:00Z' },
        { type: 'sleep', value: 7, unit: 'h', localDate: '2026-06-12', loggedAtUtc: '2026-06-12T07:00:00Z' }
      ]
    });
    expect(service.checkin()).toEqual({ weightKg: 79, sleepHours: 7 });
  });
});

describe('latestCheckin', () => {
  it('takes the first entry per type (series is newest-first) and is case-insensitive', () => {
    const items: MetricEntryDto[] = [
      { type: 'Weight', value: 79, unit: 'kg', localDate: '2026-06-12', loggedAtUtc: 'x' },
      { type: 'weight', value: 80, unit: 'kg', localDate: '2026-06-11', loggedAtUtc: 'y' }
    ];
    expect(latestCheckin(items)).toEqual({ weightKg: 79, sleepHours: null });
  });

  it('returns nulls for an empty series', () => {
    expect(latestCheckin([])).toEqual({ weightKg: null, sleepHours: null });
  });
});
