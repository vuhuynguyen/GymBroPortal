import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * SVG completion ring (weekly-goal / week-group progress).
 * Track = --inv-grey-25, progress = --inv-primary-500, rounded cap, starts at 12 o'clock.
 */
@Component({
  selector: 'app-completion-ring',
  standalone: true,
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.viewBox]="'0 0 ' + size() + ' ' + size()"
      style="transform: rotate(-90deg); flex-shrink: 0"
      aria-hidden="true">
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="radius()"
        fill="none"
        stroke="var(--inv-grey-25)"
        [attr.stroke-width]="stroke()" />
      <circle
        [attr.cx]="size() / 2"
        [attr.cy]="size() / 2"
        [attr.r]="radius()"
        fill="none"
        stroke="var(--inv-primary-500)"
        [attr.stroke-width]="stroke()"
        [attr.stroke-dasharray]="circumference()"
        [attr.stroke-dashoffset]="dashOffset()"
        stroke-linecap="round" />
    </svg>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompletionRingComponent {
  readonly value = input(0);
  readonly total = input(0);
  readonly size = input(40);
  readonly stroke = input(5);

  readonly radius = computed(() => (this.size() - this.stroke()) / 2);
  readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly dashOffset = computed(() => {
    const pct = this.total() > 0 ? Math.min(1, this.value() / this.total()) : 0;
    return this.circumference() * (1 - pct);
  });
}
