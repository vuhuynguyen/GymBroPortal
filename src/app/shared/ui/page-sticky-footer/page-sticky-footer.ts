import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Fixed bottom bar aligned to main content width and shell sidebar (Figma action bar). */
@Component({
  selector: 'app-ui-page-sticky-footer',
  standalone: true,
  template: `
    <footer
      class="ui-page-sticky-footer fixed bottom-0 right-0 z-20 left-0 border-t border-inv-border-card bg-inv-surface-base md:left-[var(--inv-app-sidebar-width)]"
      [class.ui-page-sticky-footer--raised]="!compact()"
      role="contentinfo">
      <div
        class="mx-auto flex w-full max-w-[var(--inv-page-max-width)] flex-wrap items-center justify-between gap-2 px-4 sm:gap-3"
        [class.py-1.5]="compact()"
        [class.py-2]="!compact()"
        [class.sm:px-6]="!compact()"
        [class.lg:px-8]="!compact()">
        <ng-content />
      </div>
    </footer>
  `,
  styles: `
    :host {
      display: block;
    }

    .ui-page-sticky-footer--raised {
      box-shadow: 0 -4px 24px rgb(24 24 27 / 0.06);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageStickyFooterComponent {
  /** Tighter bar for document-style editors (e.g. plan builder). */
  readonly compact = input(false, { transform: booleanAttribute });
}
