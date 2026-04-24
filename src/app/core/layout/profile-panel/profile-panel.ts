import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../auth/auth';
import { AuthUser } from '../../auth/auth.model';

@Component({
  selector: 'app-profile-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './profile-panel.html',
  styleUrl: './profile-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfilePanelComponent {
  readonly user = input.required<AuthUser>();
  readonly closed = output<void>();

  private readonly auth = inject(AuthService);

  readonly isEditing = signal(false);
  readonly editName = signal('');
  readonly error = signal('');
  readonly isSaving = signal(false);

  startEditing(): void {
    this.editName.set(this.user().name);
    this.error.set('');
    this.isEditing.set(true);
  }

  cancel(): void {
    this.isEditing.set(false);
    this.error.set('');
  }

  save(): void {
    const name = this.editName().trim();
    if (!name) { this.error.set('Name is required'); return; }
    if (name.length < 2) { this.error.set('Name must be at least 2 characters'); return; }

    this.isSaving.set(true);
    this.auth.updateDisplayName(name);
    this.isSaving.set(false);
    this.isEditing.set(false);
    this.error.set('');
  }

  close(): void {
    this.closed.emit();
  }

  getInitial(): string {
    return (this.user().name || 'U').charAt(0).toUpperCase();
  }
}
