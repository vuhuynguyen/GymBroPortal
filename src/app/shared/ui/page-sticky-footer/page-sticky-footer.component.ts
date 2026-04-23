import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Fixed bottom bar aligned to main content width and shell sidebar (Figma action bar). */
@Component({
  selector: 'app-ui-page-sticky-footer',
  standalone: true,
  template: `
    <footer
      class="ui-page-sticky-footer fixed bottom-0 right-0 z-20 border-t border-solid border-inv-border-card bg-inv-surface-base shadow-[0_-4px_24px_rgb(24_24_27_/_0.06)] left-0 md:left-[var(--inv-app-sidebar-width)]"
      role="contentinfo">
      <div
        class="mx-auto flex w-full max-w-[var(--inv-page-max-width)] flex-wrap items-center justify-between gap-inv-3 px-4 py-3 sm:px-6 lg:px-8">
        <ng-content />
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageStickyFooterComponent {}
