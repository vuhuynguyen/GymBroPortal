import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FoodService } from './food.service';
import type { CreateCustomFoodRequest } from './food.model';

describe('FoodService', () => {
  let service: FoodService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(FoodService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches the catalog with trimmed query params', () => {
    service.search({ search: '  oats ', kind: 'Food', pageSize: 50 }).subscribe();
    const req = http.expectOne((r) => r.url === '/api/foods');
    expect(req.request.params.get('search')).toBe('oats');
    expect(req.request.params.get('kind')).toBe('Food');
    expect(req.request.params.get('pageSize')).toBe('50');
    req.flush({ items: [], page: 1, pageSize: 50, totalCount: 0 });
  });

  it('creates a custom catalog food via POST /api/foods/custom and returns the new id', () => {
    const body: CreateCustomFoodRequest = {
      name: 'Homemade bar',
      kind: 'Food',
      servingLabel: '1 bar',
      energyKcal: 220,
      proteinG: 12
    };
    let result: string | undefined;
    service.createCustom(body).subscribe((res) => (result = res.id));

    const req = http.expectOne('/api/foods/custom');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    // kind is the PascalCase enum string the API expects.
    expect(req.request.body.kind).toBe('Food');
    req.flush({ id: 'new-food-id' });

    expect(result).toBe('new-food-id');
  });
});
