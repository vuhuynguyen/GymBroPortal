import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { TenantService } from './tenant';
import { TenantDto } from './tenant.model';

describe('TenantService', () => {
  let tenants: TenantService;
  let http: HttpTestingController;

  const make = (id: string, role: TenantDto['role'], memberCount = 1): TenantDto => ({
    id,
    name: `Tenant ${id}`,
    role,
    joinedAt: '2026-01-01T00:00:00Z',
    memberCount,
    ownerName: null
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    tenants = TestBed.inject(TenantService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads tenants and auto-selects the owned workspace', async () => {
    const promise = firstValueFrom(tenants.loadTenants());
    http.expectOne('/api/tenants/mine').flush([make('client-1', 'Client', 5), make('own-1', 'Owner')]);
    await promise;

    expect(tenants.tenants().length).toBe(2);
    expect(tenants.ownTenant()?.id).toBe('own-1');
    expect(tenants.activeTenant()?.id).toBe('own-1'); // Owner workspace auto-selected
    expect(tenants.currentRole()).toBe('Owner');
  });

  it('selectTrainerWorkspace switches only to a known membership', async () => {
    const promise = firstValueFrom(tenants.loadTenants());
    http.expectOne('/api/tenants/mine').flush([make('own-1', 'Owner'), make('coach-1', 'Client', 9)]);
    await promise;

    expect(tenants.selectTrainerWorkspace('does-not-exist')).toBeFalse();
    expect(tenants.selectTrainerWorkspace('coach-1')).toBeTrue();
    expect(tenants.activeTenant()?.id).toBe('coach-1');
    expect(tenants.currentRole()).toBe('Client');
  });

  it('clear() resets state and the active selection', async () => {
    const promise = firstValueFrom(tenants.loadTenants());
    http.expectOne('/api/tenants/mine').flush([make('own-1', 'Owner')]);
    await promise;

    tenants.clear();

    expect(tenants.tenants()).toEqual([]);
    expect(tenants.activeTenantId()).toBeNull();
    expect(localStorage.getItem('gymbro_tenant_id')).toBeNull();
  });
});
