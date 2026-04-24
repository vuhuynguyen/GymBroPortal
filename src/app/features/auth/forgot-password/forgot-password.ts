import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ForgotPasswordComponent {
  readonly email = signal('');
  readonly loading = signal(false);
  readonly emailSent = signal(false);

  submit(): void {
    if (!this.email().trim()) return;
    this.loading.set(true);
    // Simulated — wire to a real endpoint when available
    setTimeout(() => {
      this.loading.set(false);
      this.emailSent.set(true);
    }, 1200);
  }

  resend(): void {
    this.loading.set(true);
    setTimeout(() => this.loading.set(false), 1200);
  }
}
