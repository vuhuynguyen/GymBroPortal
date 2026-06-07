import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { errorInterceptor } from './error-interceptor';
import { AuthService } from './auth';
import { TenantService } from '../tenant/tenant';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  const auth = { refresh: jasmine.createSpy('refresh'), logout: jasmine.createSpy('logout') };
  const messages = { add: jasmine.createSpy('add') };
  const tenants = { activeTenant: () => ({ id: 'T1' }), activeTenantId: () => 'T1' };

  beforeEach(() => {
    auth.refresh.calls.reset();
    auth.logout.calls.reset();
    messages.add.calls.reset();
    auth.refresh.and.returnValue(of('new-token'));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth as unknown as AuthService },
        { provide: TenantService, useValue: tenants as unknown as TenantService },
        { provide: MessageService, useValue: messages as unknown as MessageService }
      ]
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('silently refreshes once and REPLACES stale headers on the replay after a 401', () => {
    let body: unknown;
    // The original request carries a now-stale token and tenant; the replay must overwrite both.
    http
      .get('/api/widgets', { headers: { Authorization: 'Bearer stale', 'X-Tenant-Id': 'OLD' } })
      .subscribe({ next: (r) => (body = r), error: () => undefined });

    const original = ctrl.expectOne('/api/widgets');
    expect(original.request.headers.get('Authorization')).toBe('Bearer stale');
    original.flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.refresh).toHaveBeenCalledTimes(1);

    const retry = ctrl.expectOne('/api/widgets');
    // Proves withFreshHeaders re-applied BOTH headers (not left the stale ones).
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(retry.request.headers.get('X-Tenant-Id')).toBe('T1');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
  });

  it('does not refresh on a 401 from an auth endpoint', () => {
    let status: number | undefined;
    http.post('/api/auth/login', {}).subscribe({ next: () => undefined, error: (e) => (status = e.status) });

    ctrl.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.refresh).not.toHaveBeenCalled();
    expect(status).toBe(401);
  });

  it('logs out when the refresh itself fails', () => {
    auth.refresh.and.returnValue(throwError(() => new Error('refresh failed')));
    http.get('/api/widgets').subscribe({ next: () => undefined, error: () => undefined });

    ctrl.expectOne('/api/widgets').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.logout).toHaveBeenCalledTimes(1);
  });

  it('surfaces a toast for non-401 errors', () => {
    http.get('/api/widgets').subscribe({ next: () => undefined, error: () => undefined });

    ctrl.expectOne('/api/widgets').flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(messages.add).toHaveBeenCalledTimes(1);
  });
});
