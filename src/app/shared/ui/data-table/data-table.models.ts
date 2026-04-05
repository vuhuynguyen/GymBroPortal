/**
 * Column model for {@link DataTableComponent}: declarative filters, cell types, and optional custom templates.
 */
export type TableColumnType = 'text' | 'tag' | 'custom';

export type TableColumnFilterType = 'text' | 'select';

export type TableTagSeverity =
  | 'success'
  | 'secondary'
  | 'info'
  | 'warn'
  | 'danger'
  | 'contrast';

export interface TableColumnSelectOption {
  readonly label: string;
  readonly value: unknown;
}

export interface TableColumn {
  readonly field: string;
  readonly header: string;
  readonly type?: TableColumnType;
  readonly filter?: boolean;
  /** When `filter` is true and this is omitted, a text filter is used. */
  readonly filterType?: TableColumnFilterType;
  /** Required when `filterType === 'select'`. */
  readonly options?: readonly TableColumnSelectOption[];
  /**
   * When false, this field is omitted from PrimeNG global filter fields.
   * @default true (except implicit skip for `field === 'actions'`).
   */
  readonly includeInGlobalSearch?: boolean;
  /** Prime match mode for column text filters. @default 'contains' */
  readonly textFilterMatchMode?: string;
  /** Prime match mode for column select filters. @default 'equals' */
  readonly selectFilterMatchMode?: string;
  /** Default severity when `type === 'tag'` and resolver is absent. */
  readonly tagSeverity?: TableTagSeverity;
  /** Map cell value → tag severity when `type === 'tag'`. */
  readonly tagSeverityByValue?: Readonly<Record<string, TableTagSeverity>>;
  /** Dynamic tag severity when `type === 'tag'`. */
  readonly tagSeverityResolver?: (value: unknown, row: Record<string, unknown>) => TableTagSeverity;
  /** CSS max-width applied to both the header and cell, e.g. `'320px'` or `'20rem'`. */
  readonly maxWidth?: string;
}
