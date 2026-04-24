import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { InviteComponent } from '../../../features/workspace/invite/invite';

@Component({
  selector: 'app-invite-gymbro-panel',
  standalone: true,
  imports: [InviteComponent],
  templateUrl: './invite-gymbro-panel.html',
  styleUrls: ['../join-gymbro-panel/join-gymbro-panel.scss', './invite-gymbro-panel.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InviteGymBroPanelComponent {
  readonly closed = output<void>();

  close(): void {
    this.closed.emit();
  }
}
