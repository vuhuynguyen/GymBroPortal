import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse, AuthUser, LoginRequest, MeDto } from './auth.model';
import { TenantService } from '../tenant/tenant';

const TOKEN_KEY = 'gymbro_token';

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

  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly profile = signal<MeDto | null>(null);
  private profileRequestToken: string | null = null;

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
      email: me.email ?? '',
      name: me.name,
      isPlatformAdmin: me.isPlatformAdmin
    };
  });

  constructor() {
    if (this.token()) {
      this.loadProfile();
    }
  }

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password } satisfies LoginRequest)
      .pipe(tap((res) => this.storeToken(res.token)));
  }

  register(email: string, password: string, name?: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', {
        email,
        password,
        fullName: name?.trim() ?? ''
      })
      .pipe(tap((res) => this.storeToken(res.token)));
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
    if (!force && this.profile() && this.profileRequestToken === token) {
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
    localStorage.removeItem(TOKEN_KEY);
    this.tenantService.clear();
    this.token.set(null);
    this.profile.set(null);
    this.profileRequestToken = null;
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
    localStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
    this.profileRequestToken = null;
    this.loadProfile(true);
  }
}
