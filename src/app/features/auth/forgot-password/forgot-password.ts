import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  private readonly auth = inject(AuthService);

  readonly email = signal('');
  readonly loading = signal(false);
  readonly emailSent = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    const value = this.email().trim();
    if (!value) return;
    this.loading.set(true);
    this.error.set(null);
    this.auth
      .forgotPassword(value)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.emailSent.set(true),
        error: () => this.error.set('Unable to process request. Please try again.')
      });
  }

  resend(): void {
    this.submit();
  }
}
