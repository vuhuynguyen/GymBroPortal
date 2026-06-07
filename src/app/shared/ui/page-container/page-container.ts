import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Centers page content to `--inv-page-max-width` (shell outlet supplies horizontal padding).
 */
@Component({
  selector: 'app-ui-page-container',
  standalone: true,
  template: `
    <div class="ui-page-container block w-full min-w-0 max-w-[var(--inv-page-max-width)] mx-auto">
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
export class PageContainerComponent {}
