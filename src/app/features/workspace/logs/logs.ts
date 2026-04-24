import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-logs',
  standalone: true,
  template: `<p>Workout Log — coming soon</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LogsComponent {}
