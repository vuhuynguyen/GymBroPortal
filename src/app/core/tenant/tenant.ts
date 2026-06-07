import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TenantDto } from './tenant.model';

const TENANT_KEY = 'gymbro_tenant_id';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private readonly http = inject(HttpClient);
  private loadOnce: Promise<void> | null = null;

  readonly tenants = signal<TenantDto[]>([]);
  readonly activeTenantId = signal<string | null>(localStorage.getItem(TENANT_KEY));

  /** The tenant the user owns (their own workspace) */
  readonly ownTenant = computed(() => this.tenants().find((t) => t.role === 'Owner') ?? null);

  /** Tenants where the user is a trainee (joined a trainer) */
  readonly trainerWorkspaces = computed(() => this.tenants().filter((t) => t.role === 'Client'));

  /** True if user has at least one client in their own workspace */
  readonly hasClients = computed(() => (this.ownTenant()?.memberCount ?? 1) > 1);

  /** The active tenant used for API calls (X-Tenant-Id header) */
  readonly activeTenant = computed(() => {
    const id = this.activeTenantId();
    const list = this.tenants();
    return list.find((t) => t.id === id) ?? list[0] ?? null;
  });

  readonly currentRole = computed(() => this.activeTenant()?.role ?? null);

  loadTenants() {
    return this.http.get<TenantDto[]>('/api/tenants/mine').pipe(
      tap((tenants) => {
        this.tenants.set(tenants);
        const stored = this.activeTenantId();
        if (stored && tenants.some((t) => t.id === stored)) {
          return;
        }
        const ownTenant = tenants.find((t) => t.role === 'Owner');
        if (ownTenant) {
          this.setActiveTenant(ownTenant.id);
        } else if (tenants.length > 0) {
          this.setActiveTenant(tenants[0].id);
        }
      })
    );
  }

  /**
   * Load tenants once if not already loaded (idempotent, single-flight). Guards await this on entry so
   * `currentRole()` is populated before route activation — fixes the race where a deep-link/refresh to an
   * Owner-gated route evaluated `roleGuard` before any `loadTenants()` had run. Resolves (never rejects)
   * even on failure, so a guard simply falls through to its redirect. Use `loadTenants()` to force a refresh.
   */
  ensureLoaded(): Promise<void> {
    if (this.tenants().length > 0) return Promise.resolve();
    this.loadOnce ??= firstValueFrom(this.loadTenants()).then(
      () => { this.loadOnce = null; },
      () => { this.loadOnce = null; }
    );
    return this.loadOnce;
  }

  setActiveTenant(id: string): void {
    localStorage.setItem(TENANT_KEY, id);
    this.activeTenantId.set(id);
  }

  /** Use the user's owned workspace (trainer templates, assignments, clients). */
  selectOwnWorkspace(): void {
    const own = this.ownTenant();
    if (own) this.setActiveTenant(own.id);
  }

  /**
   * Scope API calls to a coach workspace the user joined as Client.
   * Returns false if the id is not a known membership.
   */
  selectTrainerWorkspace(trainerTenantId: string): boolean {
    const id = trainerTenantId?.trim();
    if (!id) return false;
    const list = this.tenants();
    if (!list.some((t) => t.id === id)) return false;
    this.setActiveTenant(id);
    return true;
  }

  clear(): void {
    localStorage.removeItem(TENANT_KEY);
    this.tenants.set([]);
    this.activeTenantId.set(null);
  }
}
