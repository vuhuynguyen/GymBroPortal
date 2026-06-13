import { ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SelectModule } from 'primeng/select';

/** Design-system dropdown: PrimeNG 21+ `p-select` (not legacy `p-dropdown`). */
@Component({
  selector: 'app-select',
  standalone: true,
  imports: [SelectModule, FormsModule],
  template: `
    <p-select
      [inputId]="inputId() || undefined"
      [options]="optionItems()"
      optionLabel="label"
      optionValue="value"
      [placeholder]="placeholder()"
      [disabled]="disabled"
      [showClear]="showClear()"
      [(ngModel)]="value"
      [ngModelOptions]="{ standalone: true }"
      (ngModelChange)="onSelectChange($event)"
      appendTo="body"
      styleClass="w-full" />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ],
  host: { class: 'block w-full min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectComponent implements ControlValueAccessor {
  readonly options = input.required<readonly string[]>();
  readonly inputId = input<string>('');
  readonly placeholder = input<string>('');
  readonly showClear = input(false);

  readonly optionItems = computed(() =>
    this.options().map((o) => ({ label: o, value: o }))
  );

  value: string | null = null;
  disabled = false;

  private onChange: (v: string | null) => void = () => {};
  private onTouchedFn: () => void = () => {};

  writeValue(v: string | null): void {
    this.value = v ?? null;
  }

  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouchedFn = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onSelectChange(v: string | null): void {
    this.value = v;
    this.onChange(v);
    this.onTouchedFn();
  }
}
