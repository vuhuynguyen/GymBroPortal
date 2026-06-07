import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  effect,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../button/button';
import { InputComponent } from '../input/input';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinner } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { Table, TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import type { TableFilterEvent } from 'primeng/types/table';
import { DataTableCellTemplateDirective, type DataTableCellTemplateContext } from './data-table-cell-template-directive';
import type { TableColumn, TableColumnSelectOption, TableTagSeverity } from './data-table.models';

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    ButtonComponent,
    IconField,
    InputIcon,
    InputTextModule,
    InputComponent,
    ProgressSpinner,
    SelectModule,
    TableModule,
    TagModule
  ],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[attr.aria-label]': 'hostAriaLabel()'
  }
})
export class DataTableComponent {
  readonly columns = input<readonly TableColumn[]>([]);
  /** Row objects; indexed by `field` from {@link columns}. */
  readonly data = input<any[]>([]);
  readonly loading = input(false);
  /** Extra row fields included in PrimeNG global filter (e.g. `description` when not a column). */
  readonly globalFilterExtraFields = input<readonly string[]>([]);
  readonly globalSearchPlaceholder = input<string>('Search…');
  readonly emptyMessage = input<string>('No results');
  readonly loadingMessage = input<string>('Loading…');
  readonly paginator = input(true);
  readonly rows = input(5);
  readonly rowsPerPageOptions = input<number[]>([5, 10, 25]);
  readonly pageReportTemplate = input<string>('Showing {first} to {last} of {totalRecords} entries');
  /** Fixed scroll height for the table body, e.g. "calc(100vh - 420px)" or "400px". */
  readonly scrollHeight = input<string | undefined>(undefined);
  readonly resizableColumns = input(false);
  readonly columnResizeMode = input<'fit' | 'expand'>('expand');
  /** Optional card chrome (feature pages often use {@link PageHeaderComponent} instead). */
  readonly cardTitle = input<string>();
  readonly cardSubheader = input<string>();
  readonly itemLabel = input<string>('rows');
  readonly showFilteredCount = input(true);
  readonly lazy = input(false);
  readonly totalRecords = input(0);
  readonly globalFilterDebounceMs = input(500);
  readonly lazyLoad = output<unknown>();

  private readonly tableRef = viewChild<Table<any>>('dt');
  private readonly cellTemplateDirectives = contentChildren(DataTableCellTemplateDirective);

  /** Updated from PrimeNG `onFilter`; `null` means use {@link data} length. */
  private readonly filteredRowCount = signal<number | null>(null);

  protected readonly searchValue = signal('');
  private globalFilterDebounceHandle: ReturnType<typeof setTimeout> | null = null;

  readonly globalFilterFields = computed((): string[] => {
    const cols = this.columns();
    const fromCols = cols
      .filter((c) => c.field !== 'actions' && c.includeInGlobalSearch !== false)
      .map((c) => c.field);
    const extra = this.globalFilterExtraFields();
    return [...fromCols, ...extra];
  });

  readonly hasColumnFilters = computed(() => this.columns().some((c) => c.filter));

  readonly showFilterToolbar = computed(
    () => this.globalFilterFields().length > 0 || this.hasColumnFilters()
  );

  readonly displayRowCount = computed(() => {
    if (this.lazy()) return this.totalRecords();
    const n = this.filteredRowCount();
    return n !== null ? n : this.data().length;
  });

  protected readonly hostAriaLabel = computed((): string | undefined => {
    const t = this.cardTitle();
    const n = this.displayRowCount();
    const label = this.itemLabel();
    if (t) {
      return `${t}, ${n} ${label}`;
    }
    return undefined;
  });

  protected templateForField(field: string) {
    const dir = this.cellTemplateDirectives().find((d) => d.fieldName() === field);
    return dir?.templateRef ?? null;
  }

  protected cellContext(row: unknown, column: TableColumn): DataTableCellTemplateContext {
    return { $implicit: row as Record<string, unknown>, column };
  }

  protected resolveTagSeverity(column: TableColumn, row: unknown): TableTagSeverity {
    const r = row as Record<string, unknown>;
    const value = r[column.field];
    const resolver = column.tagSeverityResolver;
    if (resolver) {
      return resolver(value, r);
    }
    const map = column.tagSeverityByValue;
    if (map && value !== null && value !== undefined) {
      const key = String(value);
      if (key in map) {
        return map[key] as TableTagSeverity;
      }
    }
    return column.tagSeverity ?? 'secondary';
  }

  protected formatText(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value);
  }

  protected filterMatchMode(column: TableColumn, kind: 'text' | 'select'): string {
    if (kind === 'select') {
      return column.selectFilterMatchMode ?? 'equals';
    }
    return column.textFilterMatchMode ?? 'contains';
  }

  protected selectFilterOptions(column: TableColumn): TableColumnSelectOption[] {
    return [...(column.options ?? [])];
  }

  clearFilters(): void {
    this.searchValue.set('');
    this.tableRef()?.clear();
  }

  onGlobalFilterInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchValue.set(value);

    if (this.globalFilterDebounceHandle) {
      clearTimeout(this.globalFilterDebounceHandle);
    }

    this.globalFilterDebounceHandle = setTimeout(() => {
      this.tableRef()?.filterGlobal(value, 'contains');
      this.globalFilterDebounceHandle = null;
    }, this.globalFilterDebounceMs());
  }

  onTableFilter(event: TableFilterEvent): void {
    if (this.lazy()) {
      this.filteredRowCount.set(null);
      return;
    }

    const fv = event.filteredValue;
    this.filteredRowCount.set(Array.isArray(fv) ? fv.length : null);
  }

  onTableLazyLoad(event: unknown): void {
    this.lazyLoad.emit(event);
  }

  constructor() {
    effect(() => {
      void this.data();
      this.filteredRowCount.set(null);
    });

    effect((onCleanup) => {
      const debounceMs = this.globalFilterDebounceMs();
      if (debounceMs < 0 && this.globalFilterDebounceHandle) {
        clearTimeout(this.globalFilterDebounceHandle);
        this.globalFilterDebounceHandle = null;
      }

      onCleanup(() => {
        if (this.globalFilterDebounceHandle) {
          clearTimeout(this.globalFilterDebounceHandle);
          this.globalFilterDebounceHandle = null;
        }
      });
    });
  }
}
