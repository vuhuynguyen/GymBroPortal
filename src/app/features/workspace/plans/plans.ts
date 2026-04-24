import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-plans',
  standalone: true,
  template: `<p>Plans — coming soon</p>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlansComponent {}
