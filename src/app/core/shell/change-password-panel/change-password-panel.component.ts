import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
  computed
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../auth/auth.service';

interface PasswordStrength {
  level: number;
  label: string;
  colorClass: string;
}

@Component({
  selector: 'app-change-password-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './change-password-panel.component.html',
  styleUrl: './change-password-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChangePasswordPanelComponent {
  readonly closed = output<void>();
  readonly success = output<void>();

  private readonly auth = inject(AuthService);

  readonly currentPassword = signal('');
  readonly newPassword = signal('');
  readonly confirmPassword = signal('');

  readonly showCurrent = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);

  readonly error = signal('');
  readonly isLoading = signal(false);

  readonly strength = computed<PasswordStrength>(() => this.calcStrength(this.newPassword()));

  readonly hasMinLen = computed(() => this.newPassword().length >= 8);
  readonly hasMixedCase = computed(() => /[a-z]/.test(this.newPassword()) && /[A-Z]/.test(this.newPassword()));
  readonly hasNumber = computed(() => /\d/.test(this.newPassword()));
  readonly hasSpecial = computed(() => /[!@#$%^&*()\-_=+\[\]{};':"|,.<>/?`~]/.test(this.newPassword()));
  readonly passwordsMismatch = computed(() =>
    !!this.confirmPassword() && this.newPassword() !== this.confirmPassword()
  );

  private calcStrength(pw: string): PasswordStrength {
    if (!pw) return { level: 0, label: '', colorClass: '' };
    if (pw.length < 6) return { level: 1, label: 'Too Short', colorClass: 'strength--weak' };
    let s = 0;
    if (pw.length >= 8) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[!@#$%^&*()\-_=+\[\]{};':"|,.<>/?`~]/.test(pw)) s++;
    if (s <= 1) return { level: 2, label: 'Weak', colorClass: 'strength--weak' };
    if (s === 2) return { level: 3, label: 'Fair', colorClass: 'strength--fair' };
    if (s === 3) return { level: 4, label: 'Good', colorClass: 'strength--good' };
    return { level: 5, label: 'Strong', colorClass: 'strength--strong' };
  }

  submit(): void {
    this.error.set('');
    if (!this.currentPassword()) { this.error.set('Please enter your current password'); return; }
    if (!this.newPassword()) { this.error.set('Please enter a new password'); return; }
    if (this.currentPassword() === this.newPassword()) { this.error.set('New password must differ from current password'); return; }
    if (this.newPassword() !== this.confirmPassword()) { this.error.set('Passwords do not match'); return; }

    if (this.newPassword().length < 8) { this.error.set('Password must be at least 8 characters'); return; }
    if (!/[A-Z]/.test(this.newPassword())) { this.error.set('Password must contain at least one uppercase letter'); return; }
    if (!/[a-z]/.test(this.newPassword())) { this.error.set('Password must contain at least one lowercase letter'); return; }
    if (!/[0-9]/.test(this.newPassword())) { this.error.set('Password must contain at least one number'); return; }
    if (!/[!@#$%^&*()\-_=+\[\]{};':"|,.<>/?`~]/.test(this.newPassword())) { this.error.set('Password must contain at least one special character'); return; }

    this.isLoading.set(true);
    this.auth.changePassword(this.currentPassword(), this.newPassword()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.success.emit();
        this.closed.emit();
      },
      error: () => {
        this.isLoading.set(false);
        this.error.set('Failed to change password. Please check your current password and try again.');
      }
    });
  }

  close(): void {
    this.closed.emit();
  }
}
