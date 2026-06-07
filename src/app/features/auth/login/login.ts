import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { TenantService } from '../../../core/tenant/tenant';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);

  readonly loading = signal(false);
  readonly error = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);

  submitEmail(): void {
    this.error.set('');
    const email = this.email().trim();
    const pw = this.password();
    if (!email) {
      this.error.set('Please enter your email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.error.set('Please enter a valid email address');
      return;
    }
    if (!pw) {
      this.error.set('Please enter your password');
      return;
    }
    if (pw.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    this.loading.set(true);
    this.auth.login(email, pw).subscribe({
      next: () => this.tenantService.loadTenants().subscribe(() => void this.router.navigateByUrl('/')),
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.error ?? 'Invalid email or password';
        this.error.set(typeof msg === 'string' ? msg : 'Invalid email or password');
      }
    });
  }
}
