import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  QueryList,
  signal,
  ViewChildren
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';
import { FeaturesService } from '../../../core/feature-flags/feature-flags';
import { TenantService } from '../../../core/tenant/tenant';

type Method = 'email' | 'phone';
type PhoneStep = 'input' | 'otp';

const COUNTRY_CODES = [
  { label: '🇻🇳 +84', value: '+84' },
  { label: '🇺🇸 +1',  value: '+1'  },
  { label: '🇬🇧 +44', value: '+44' },
  { label: '🇸🇬 +65', value: '+65' },
  { label: '🇨🇳 +86', value: '+86' },
  { label: '🇮🇳 +91', value: '+91' },
  { label: '🇮🇩 +62', value: '+62' },
  { label: '🇵🇭 +63', value: '+63' },
  { label: '🇹🇭 +66', value: '+66' },
];

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent implements AfterViewInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly tenantService = inject(TenantService);
  readonly features = inject(FeaturesService);

  @ViewChildren('otpInput') otpInputs!: QueryList<ElementRef<HTMLInputElement>>;

  // ── shared ────────────────────────────────────────────────────────────────
  readonly method = signal<Method>('email');
  readonly loading = signal(false);
  readonly error = signal('');

  // ── email ─────────────────────────────────────────────────────────────────
  readonly email = signal('');
  readonly password = signal('');
  readonly showPassword = signal(false);

  // ── phone ─────────────────────────────────────────────────────────────────
  readonly countryCodes = COUNTRY_CODES;
  readonly countryCode = signal('+84');
  readonly phoneNumber = signal('');
  readonly phoneStep = signal<PhoneStep>('input');
  readonly otp = signal(['', '', '', '', '', '']);
  readonly resendSeconds = signal(0);

  private resendInterval: ReturnType<typeof setInterval> | null = null;

  ngAfterViewInit(): void {
    this.otpInputs.changes.subscribe(() => {
      const first = this.otpInputs.first;
      if (first) setTimeout(() => first.nativeElement.focus(), 0);
    });
  }

  switchMethod(m: Method): void {
    this.error.set('');
    this.method.set(m);
    if (m === 'phone') {
      this.phoneStep.set('input');
      this.otp.set(['', '', '', '', '', '']);
    }
  }

  // ── email submit ──────────────────────────────────────────────────────────
  submitEmail(): void {
    this.error.set('');
    const email = this.email().trim();
    const pw = this.password();
    if (!email) { this.error.set('Please enter your email'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.error.set('Please enter a valid email address'); return; }
    if (!pw) { this.error.set('Please enter your password'); return; }
    if (pw.length < 6) { this.error.set('Password must be at least 6 characters'); return; }

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

  // ── phone: send OTP ───────────────────────────────────────────────────────
  sendOtp(): void {
    this.error.set('');
    const digits = this.phoneNumber().replace(/\D/g, '');
    if (!digits) { this.error.set('Please enter your phone number'); return; }
    if (digits.length < 9 || digits.length > 11) { this.error.set('Please enter a valid phone number (9–11 digits)'); return; }

    this.loading.set(true);
    const full = `${this.countryCode()}${digits}`;
    this.auth.requestOtp(full).subscribe({
      next: () => {
        this.loading.set(false);
        this.phoneStep.set('otp');
        this.startResendTimer();
      },
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.error ?? 'Failed to send OTP. Please try again.';
        this.error.set(typeof msg === 'string' ? msg : 'Failed to send OTP');
      }
    });
  }

  resendOtp(): void {
    if (this.resendSeconds() > 0) return;
    this.otp.set(['', '', '', '', '', '']);
    this.error.set('');
    this.sendOtp();
  }

  backToPhoneInput(): void {
    this.phoneStep.set('input');
    this.otp.set(['', '', '', '', '', '']);
    this.error.set('');
    this.stopResendTimer();
  }

  // ── OTP inputs ────────────────────────────────────────────────────────────
  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/\D/g, '').slice(-1);
    input.value = val;
    const digits = [...this.otp()];
    digits[index] = val;
    this.otp.set(digits);
    this.error.set('');
    if (val && index < 5) {
      this.otpInputs.get(index + 1)?.nativeElement.focus();
    }
    if (digits.every((d) => d) && index === 5) {
      this.submitOtp(digits.join(''));
    }
  }

  onOtpKeydown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.otp()[index] && index > 0) {
      this.otpInputs.get(index - 1)?.nativeElement.focus();
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, 6) ?? '';
    if (!pasted) return;
    const digits = ['', '', '', '', '', ''];
    pasted.split('').forEach((c, i) => { digits[i] = c; });
    this.otp.set(digits);
    const last = Math.min(pasted.length - 1, 5);
    this.otpInputs.get(last)?.nativeElement.focus();
    if (digits.every((d) => d)) this.submitOtp(digits.join(''));
  }

  submitOtp(code: string): void {
    this.error.set('');
    if (code.length !== 6) return;
    this.loading.set(true);
    const full = `${this.countryCode()}${this.phoneNumber().replace(/\D/g, '')}`;
    this.auth.verifyOtp(full, code).subscribe({
      next: () => this.tenantService.loadTenants().subscribe(() => void this.router.navigateByUrl('/')),
      error: (err) => {
        this.loading.set(false);
        const msg = err?.error?.message ?? err?.error ?? 'Invalid verification code';
        this.error.set(typeof msg === 'string' ? msg : 'Invalid verification code');
      }
    });
  }

  otpFilled(): boolean {
    return this.otp().every((d) => !!d);
  }

  // ── helpers ───────────────────────────────────────────────────────────────
  maskedPhone(): string {
    const digits = this.phoneNumber().replace(/\D/g, '');
    if (digits.length < 6) return digits;
    return digits.slice(0, 3) + '****' + digits.slice(-3);
  }

  setCountryCode(event: Event): void {
    this.countryCode.set((event.target as HTMLSelectElement).value);
  }

  setPhoneNumber(event: Event): void {
    const cleaned = (event.target as HTMLInputElement).value.replace(/\D/g, '');
    (event.target as HTMLInputElement).value = cleaned;
    this.phoneNumber.set(cleaned);
  }

  private startResendTimer(): void {
    this.resendSeconds.set(60);
    this.stopResendTimer();
    this.resendInterval = setInterval(() => {
      const s = this.resendSeconds() - 1;
      this.resendSeconds.set(s);
      if (s <= 0) this.stopResendTimer();
    }, 1000);
  }

  private stopResendTimer(): void {
    if (this.resendInterval) {
      clearInterval(this.resendInterval);
      this.resendInterval = null;
    }
  }
}
