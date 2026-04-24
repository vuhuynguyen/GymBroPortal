import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss'
})
export class PageHeaderComponent {
  /** `hero` — large title + spacing for full-page editors (Figma Edit Exercise). */
  readonly variant = input<'default' | 'hero'>('default');
  readonly title = input.required<string>();
  readonly subtitle = input<string>();
}
