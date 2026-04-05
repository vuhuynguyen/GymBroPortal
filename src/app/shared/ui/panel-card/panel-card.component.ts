import { Component, computed, input } from '@angular/core';
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

  readonly mergedCardClass = computed(() => {
    const extra = this.cardClass().trim();
    return ['ui-panel-card', extra].filter(Boolean).join(' ');
  });
}
