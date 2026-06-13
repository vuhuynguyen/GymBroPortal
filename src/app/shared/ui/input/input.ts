import { booleanAttribute, ChangeDetectionStrategy, Component, computed, forwardRef, input } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [InputTextModule, TextareaModule],
  template: `
    @if (!multiline()) {
      <input
        pInputText
        class="w-full"
        [attr.id]="inputId() || null"
        [type]="type()"
        [attr.placeholder]="placeholder() || null"
        [attr.autocomplete]="autocomplete()"
        [attr.maxlength]="maxLenAttr() ?? null"
        [disabled]="disabled"
        [value]="value"
        (input)="onInput($event)"
        (change)="onInput($event)"
        (blur)="onBlur()" />
    } @else {
      <textarea
        pTextarea
        class="w-full min-w-0"
        [attr.id]="inputId() || null"
        [attr.rows]="rows()"
        [attr.placeholder]="placeholder() || null"
        [attr.autocomplete]="autocomplete()"
        [attr.maxlength]="maxLenAttr() ?? null"
        [disabled]="disabled"
        [value]="value"
        (input)="onInput($event)"
        (change)="onInput($event)"
        (blur)="onBlur()"></textarea>
    }
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  host: { class: 'block w-full min-w-0' },
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InputComponent implements ControlValueAccessor {
  readonly inputId = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');
  /** When true, renders a multi-line textarea (same reactive form binding as single-line). */
  readonly multiline = input(false, { transform: booleanAttribute });
  readonly rows = input(4);
  /** When set, maps to native `maxlength` on input/textarea. */
  readonly maxLength = input<number | undefined>(undefined);

  readonly maxLenAttr = computed(() => {
    const n = this.maxLength();
    return n != null && n > 0 ? n : null;
  });

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
    const v = (ev.target as HTMLInputElement | HTMLTextAreaElement).value;
    this.value = v;
    this.onChange(v);
  }
}
