import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ButtonModule } from 'primeng/button';

export type AppButtonSeverity =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'info'
  | 'warn'
  | 'help'
  | 'danger'
  | 'contrast';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [ButtonModule],
  template: `
    <p-button
      [label]="label()"
      [icon]="icon()"
      [iconPos]="iconPos()"
      [severity]="severity()"
      [outlined]="outlined()"
      [text]="text()"
      [rounded]="rounded()"
      [disabled]="disabled()"
      [type]="type()"
      [size]="size()"
      [loading]="loading()"
      [ariaLabel]="ariaLabel()"
      [attr.aria-pressed]="ariaPressed()"
      [styleClass]="mergedClass()"
      (onClick)="clicked.emit($any($event))" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ButtonComponent {
  readonly label = input<string>();
  readonly icon = input<string>();
  readonly iconPos = input<'left' | 'right'>('left');
  readonly severity = input<AppButtonSeverity | undefined>();
  readonly outlined = input(false);
  readonly text = input(false);
  readonly rounded = input(false);
  readonly disabled = input(false);
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly size = input<'small' | 'large' | undefined>(undefined);
  readonly loading = input(false);
  readonly ariaLabel = input<string | undefined>(undefined);
  readonly ariaPressed = input<boolean | null>(null);
  /** Extra classes merged with the design-system button class. */
  readonly styleClass = input<string>('');

  readonly clicked = output<MouseEvent>();

  readonly mergedClass = computed(() => ['ui-app-button', this.styleClass()].filter(Boolean).join(' '));
}
