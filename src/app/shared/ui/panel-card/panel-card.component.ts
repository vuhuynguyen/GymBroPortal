import { booleanAttribute, Component, computed, input, output } from '@angular/core';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-ui-panel-card',
  standalone: true,
  imports: [CardModule],
  templateUrl: './panel-card.component.html',
  styleUrl: './panel-card.component.scss'
})
export class PanelCardComponent {
  /** Extra classes on the inner `p-card` (e.g. `content-card p-dark`). */
  readonly cardClass = input<string>('');
  readonly header = input<string>();
  readonly subheader = input<string>();

  /** When true, header is a full-width control with chevron; body visibility follows `expanded`. */
  readonly collapsible = input(false, { transform: booleanAttribute });

  /** Controlled expand state when `collapsible` is true. */
  readonly expanded = input(true);

  /** Stable fragment for `id` / `aria-controls` (e.g. `exercise-edit-basics`). */
  readonly sectionId = input('');

  /** Emitted when the collapsible header is activated. */
  readonly toggle = output<void>();

  readonly mergedCardClass = computed(() => {
    const extra = this.cardClass().trim();
    const parts = ['ui-panel-card', extra];
    if (this.collapsible()) {
      parts.push('ui-panel-card--collapsible');
    }
    return parts.filter(Boolean).join(' ');
  });

  readonly bodyDomId = computed(() => {
    const id = this.sectionId().trim();
    return id ? `${id}-body` : 'ui-panel-card-body';
  });

  readonly headButtonId = computed(() => {
    const id = this.sectionId().trim();
    return id ? `${id}-head` : 'ui-panel-card-head';
  });

  onToggleClick(): void {
    this.toggle.emit();
  }
}
