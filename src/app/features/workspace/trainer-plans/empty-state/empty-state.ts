import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent } from '../../../../shared/ui';

@Component({
  selector: 'app-trainer-plans-empty-state',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './empty-state.html',
  styleUrl: './empty-state.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TrainerPlansEmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly showCreateButton = input(false);
  readonly createClicked = output<void>();
}
