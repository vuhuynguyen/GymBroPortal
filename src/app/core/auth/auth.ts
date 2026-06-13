import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { AuthResponse, AuthUser, LoginRequest, MeDto } from './auth.model';
import { TenantService } from '../tenant/tenant';
import { AUTH_HTTP } from './auth-http.context';

const authHttpContext = new HttpContext().set(AUTH_HTTP, true);

function readIsPlatformAdminFromToken(token: string | null): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return false;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
      is_admin?: boolean | string;
    };
    return payload.is_admin === true || payload.is_admin === 'true';
  } catch {
    return false;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  // The access token lives ONLY in memory — never localStorage. On a full reload it is restored by a
  // silent refresh against the httpOnly refresh-token cookie. This keeps the long-lived credential
  // (the refresh token) out of reach of any XSS.
  private readonly token = signal<string | null>(null);
  private readonly profile = signal<MeDto | null>(null);
  private profileRequestToken: string | null = null;

  // A single in-flight refresh shared by bootstrap and the error interceptor, so concurrent 401s
  // trigger exactly one /api/auth/refresh call.
  private refreshInFlight: Observable<string> | null = null;

  // Bootstrap state so route guards can wait for the initial silent refresh to settle before deciding.
  private readonly bootstrapping = signal(true);
  readonly isBootstrapping = this.bootstrapping.asReadonly();
  private resolveReady!: () => void;
  readonly ready = new Promise<void>((resolve) => (this.resolveReady = resolve));

  readonly isAuthenticated = computed(() => !!this.token());

  readonly isPlatformAdmin = computed<boolean>(() => {
    const fromProfile = this.profile()?.isPlatformAdmin;
    if (fromProfile !== undefined) return fromProfile;
    return readIsPlatformAdminFromToken(this.token());
  });

  readonly currentUser = computed<AuthUser | null>(() => {
    const me = this.profile();
    if (!me) return null;
    return {
      userId: me.userId,
      email: me.email ?? '',
      name: me.name,
      isPlatformAdmin: me.isPlatformAdmin
    };
  });

  constructor() {
    // Attempt to restore a session from the refresh cookie. Either outcome unblocks the guards.
    this.refresh().subscribe({
      next: () => this.finishBootstrap(),
      error: () => this.finishBootstrap()
    });
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password } satisfies LoginRequest, {
        withCredentials: true,
        context: authHttpContext
      })
      .pipe(tap((res) => this.storeToken(res.token)));
  }

  register(email: string, password: string, name?: string) {
    return this.http
      .post<AuthResponse>(
        '/api/auth/register',
        { email, password, fullName: name?.trim() ?? '' },
        { withCredentials: true, context: authHttpContext }
      )
      .pipe(tap((res) => this.storeToken(res.token)));
  }

  /**
   * Exchange the refresh cookie for a fresh access token. Shared single-flight: repeated calls while
   * one request is outstanding return the same observable. Emits the new access token on success.
   */
  refresh(): Observable<string> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = this.http
      .post<AuthResponse>('/api/auth/refresh', {}, { withCredentials: true, context: authHttpContext })
      .pipe(
        map((res) => res.token),
        tap((token) => this.storeToken(token)),
        catchError((err) => {
          this.clearSession();
          return throwError(() => err);
        }),
        finalize(() => (this.refreshInFlight = null)),
        shareReplay(1)
      );

    return this.refreshInFlight;
  }

  forgotPassword(email: string) {
    return this.http.post<void>('/api/auth/forgot-password', { email });
  }

  resetPassword(email: string, token: string, newPassword: string) {
    return this.http.post<void>('/api/auth/reset-password', { email, token, newPassword });
  }

  loadProfile(force = false): void {
    const token = this.token();
    if (!token) {
      this.profile.set(null);
      this.profileRequestToken = null;
      return;
    }
    if (!force && this.profileRequestToken === token) {
      return;
    }

    this.profileRequestToken = token;
    this.http.get<MeDto>('/api/auth/me').subscribe({
      next: (me) => {
        if (this.token() !== token) return;
        this.profile.set(me);
      },
      error: () => {
        if (this.token() !== token) return;
        this.profile.set(null);
        this.profileRequestToken = null;
      }
    });
  }

  logout(): void {
    // Revoke the refresh token server-side (clears the cookie too); local state is cleared regardless.
    this.http
      .post<void>('/api/auth/logout', {}, { withCredentials: true, context: authHttpContext })
      .pipe(catchError(() => of(void 0)))
      .subscribe();
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  updateDisplayName(name: string): void {
    const current = this.profile();
    if (current) {
      this.profile.set({ ...current, name });
    }
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post<void>('/api/auth/change-password', { currentPassword, newPassword });
  }

  getToken(): string | null {
    return this.token();
  }

  private storeToken(token: string): void {
    this.token.set(token);
    this.profileRequestToken = null;
    this.loadProfile(true);
  }

  private clearSession(): void {
    this.tenantService.clear();
    this.token.set(null);
    this.profile.set(null);
    this.profileRequestToken = null;
  }

  private finishBootstrap(): void {
    this.bootstrapping.set(false);
    this.resolveReady();
  }
}
