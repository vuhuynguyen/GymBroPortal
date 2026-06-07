import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Toolbar row for list screens: search (left), optional filter fields (center), aside (e.g. columns).
 * Projected regions: `ui-filter-primary` (e.g. clear), `ui-filter-search`, `ui-filter-fields`, `ui-filter-aside`.
 */
@Component({
  selector: 'app-filter-bar',
  standalone: true,
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FilterBarComponent {}
