import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth';
import { deviceTimeZone } from '../timezone';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])]
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);

    // The constructor fires a silent bootstrap refresh; fail it so no session is established up front.
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });
  });

  afterEach(() => http.verify());

  it('shares one in-flight refresh across concurrent callers (single-flight)', () => {
    let first: string | undefined;
    let second: string | undefined;

    auth.refresh().subscribe((t) => (first = t));
    auth.refresh().subscribe((t) => (second = t));

    // Both subscribers must collapse onto a single /api/auth/refresh request.
    const requests = http.match('/api/auth/refresh');
    expect(requests.length).toBe(1);

    requests[0].flush({ token: 'fresh-token' });
    // storeToken() triggers a profile load — satisfy it so verify() stays clean. The stored zone already
    // matches the device, so no timezone-sync PUT fires.
    http
      .expectOne('/api/auth/me')
      .flush({ userId: 'u1', email: 'e@x', name: 'N', isPlatformAdmin: false, timeZoneId: deviceTimeZone() });

    expect(first).toBe('fresh-token');
    expect(second).toBe('fresh-token');
    expect(auth.getToken()).toBe('fresh-token');
    expect(auth.isAuthenticated()).toBeTrue();
  });

  it('reports the device timezone when the stored zone differs', () => {
    auth.refresh().subscribe();
    http.expectOne('/api/auth/refresh').flush({ token: 'fresh-token' });
    // Profile returns a zone that is not the device's → the device zone is reported once (idempotent sync).
    http
      .expectOne('/api/auth/me')
      .flush({ userId: 'u1', email: 'e@x', name: 'N', isPlatformAdmin: false, timeZoneId: 'Antarctica/Troll' });

    const put = http.expectOne('/api/me/timezone');
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ timeZoneId: deviceTimeZone() });
    put.flush(null);
  });

  it('clears the session when a refresh fails', () => {
    auth.refresh().subscribe({ next: () => undefined, error: () => undefined });
    http.expectOne('/api/auth/refresh').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(auth.getToken()).toBeNull();
    expect(auth.isAuthenticated()).toBeFalse();
  });
});
