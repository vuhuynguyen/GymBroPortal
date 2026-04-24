import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../auth.service';
import { FeaturesService } from '../../core/features/features.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly features = inject(FeaturesService);

  readonly name = signal('');
  readonly email = signal('');
  readonly password = signal('');
  readonly confirmPassword = signal('');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  readonly hasMinLen    = computed(() => this.password().length >= 8);
  readonly hasMixedCase = computed(() => /[A-Z]/.test(this.password()) && /[a-z]/.test(this.password()));
  readonly hasNumber    = computed(() => /[0-9]/.test(this.password()));
  readonly hasSpecial   = computed(() => /[!@#$%^&*()\-_=+\[\]{};':"|,.<>/?`~]/.test(this.password()));

  submit(): void {
    this.error.set('');
    const name = this.name().trim();
    const email = this.email().trim();
    const password = this.password();

    if (!name) { this.error.set('Please enter your name'); return; }
    if (name.length < 2) { this.error.set('Name must be at least 2 characters'); return; }
    if (!email) { this.error.set('Please enter your email address'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.error.set('Please enter a valid email address'); return; }
    if (!password) { this.error.set('Please enter a password'); return; }
    if (password.length < 8) { this.error.set('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(password)) { this.error.set('Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(password)) { this.error.set('Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(password)) { this.error.set('Password must contain at least one number'); return; }
    if (!/[!@#$%^&*()\-_=+\[\]{};':"|,.<>/?`~]/.test(password)) { this.error.set('Password must contain at least one special character'); return; }
    if (password !== this.confirmPassword()) { this.error.set('Passwords do not match'); return; }

    this.loading.set(true);
    this.auth.register(email, password, name).subscribe({
      next: () => void this.router.navigateByUrl('/'),
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.error ?? 'Registration failed. Please try again.';
        this.error.set(typeof msg === 'string' ? msg : 'Registration failed. Please try again.');
      }
    });
  }
}
