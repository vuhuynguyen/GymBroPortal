import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { AuthResponse, AuthUser, LoginRequest } from './auth.model';

const TOKEN_KEY = 'gymbro_token';
const NAME_KEY = 'gymbro_name';

function decodeJwtPayload(token: string): Record<string, unknown> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return {};
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  private readonly displayName = signal<string | null>(localStorage.getItem(NAME_KEY));

  readonly isAuthenticated = computed(() => !!this.token());

  readonly currentUser = computed<AuthUser | null>(() => {
    const t = this.token();
    if (!t) return null;
    const payload = decodeJwtPayload(t);
    const email = String(payload['email'] ?? payload['sub'] ?? '');
    const name = this.displayName() ?? String(payload['name'] ?? email.split('@')[0] ?? 'User');
    return { email, name };
  });

  login(email: string, password: string) {
    return this.http
      .post<AuthResponse>('/api/auth/login', { email, password } satisfies LoginRequest)
      .pipe(tap((res) => this.storeToken(res.token)));
  }

  requestOtp(phoneNumber: string) {
    return this.http.post<void>('/api/auth/request-otp', { phoneNumber });
  }

  verifyOtp(phoneNumber: string, otp: string) {
    return this.http
      .post<AuthResponse>('/api/auth/verify-otp', { phoneNumber, otp })
      .pipe(tap((res) => this.storeToken(res.token)));
  }

  register(email: string, password: string, name?: string) {
    return this.http
      .post<AuthResponse>('/api/auth/register', { email, password })
      .pipe(
        tap((res) => {
          this.storeToken(res.token);
          if (name) {
            localStorage.setItem(NAME_KEY, name);
            this.displayName.set(name);
          }
        })
      );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    this.token.set(null);
    this.displayName.set(null);
    void this.router.navigateByUrl('/login');
  }

  updateDisplayName(name: string): void {
    localStorage.setItem(NAME_KEY, name);
    this.displayName.set(name);
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
  }
}
