import { booleanAttribute, ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Read-only chip list with remove actions (e.g. secondary muscle groups on exercise form).
 */
@Component({
  selector: 'app-chip-removable-list',
  standalone: true,
  imports: [],
  templateUrl: './chip-removable-list.html',
  styleUrl: './chip-removable-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block min-w-0' }
})
export class ChipRemovableListComponent {
  readonly sectionLabel = input<string>();
  readonly emptyText = input<string>('None selected');
  /** When false and there are no chips, omit the dashed empty placeholder (Figma-style). */
  readonly showEmptyPlaceholder = input(true, { transform: booleanAttribute });
  readonly chips = input.required<readonly string[]>();
  readonly removeAriaLabel = input<string>('Remove');
  /** Color variant for the chip style. Defaults to primary (blue). */
  readonly color = input<'primary' | 'warning' | 'indigo'>('primary');

  readonly removed = output<string>();
}
