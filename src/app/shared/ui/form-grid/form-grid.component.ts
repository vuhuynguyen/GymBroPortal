import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Two-column field grid (stacks below 480px). Matches Figma classification / metrics rows. */
@Component({
  selector: 'app-ui-form-grid',
  standalone: true,
  template: `
    <div
      class="grid min-w-0 grid-cols-1 gap-inv-4 min-[480px]:grid-cols-2 min-[480px]:gap-x-inv-4 min-[480px]:gap-y-inv-5">
      <ng-content />
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      min-width: 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormGridComponent {}
