import { Directive, inject, input, TemplateRef } from '@angular/core';
import type { TableColumn } from './data-table.models';

export interface DataTableCellTemplateContext {
  readonly $implicit: Record<string, unknown>;
  readonly column: TableColumn;
}

/**
 * Marks an `ng-template` as the body cell renderer for a column (`type: 'custom'` or any field override).
 *
 * @example
 * ```html
 * <ng-template appDataTableCell="name" let-row let-column="column">
 *   <span>{{ row['title'] }}</span>
 * </ng-template>
 * ```
 */
@Directive({
  selector: 'ng-template[appDataTableCell]',
  standalone: true
})
export class DataTableCellTemplateDirective {
  readonly fieldName = input.required<string>({ alias: 'appDataTableCell' });
  readonly templateRef = inject(TemplateRef<DataTableCellTemplateContext>);
}
