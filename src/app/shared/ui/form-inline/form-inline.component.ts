import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Select + primary action row (Figma secondary muscle row). Main field in default slot;
 * put `app-button` with class `ui-form-inline-action` in the action slot.
 */
@Component({
  selector: 'app-ui-form-inline',
  standalone: true,
  template: `
    <div
      class="flex min-w-0 flex-col gap-inv-3 min-[560px]:flex-row min-[560px]:items-end min-[560px]:gap-inv-4">
      <div class="min-w-0 flex-1">
        <ng-content />
      </div>
      <div class="w-full shrink-0 min-[560px]:w-auto">
        <ng-content select=".ui-form-inline-action" />
      </div>
    </div>
  `,
  styleUrl: './form-inline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FormInlineComponent {}
