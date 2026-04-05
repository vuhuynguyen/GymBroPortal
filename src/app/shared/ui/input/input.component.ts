import { Component, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [InputTextModule],
  template: `
    <input
      pInputText
      class="w-full"
      [attr.id]="inputId() || null"
      [type]="type()"
      [placeholder]="placeholder() || null"
      [attr.autocomplete]="autocomplete()"
      [disabled]="disabled"
      [value]="value"
      (input)="onInput($event)"
      (blur)="onBlur()" />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  host: { class: 'block w-full min-w-0' }
})
export class InputComponent implements ControlValueAccessor {
  readonly inputId = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');

  value = '';
  disabled = false;

  private onChange: (v: string) => void = () => {};
  private touchedCb: () => void = () => {};

  protected onBlur(): void {
    this.touchedCb();
  }

  writeValue(v: string | null): void {
    this.value = v ?? '';
  }

  registerOnChange(fn: (v: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.touchedCb = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  protected onInput(ev: Event): void {
    const v = (ev.target as HTMLInputElement).value;
    this.value = v;
    this.onChange(v);
  }
}
