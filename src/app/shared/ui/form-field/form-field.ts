import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  template: `
    <div class="app-form-field flex flex-col">
      @if (label(); as L) {
        <label
          [attr.for]="forId() || null"
          class="app-form-field__label text-inv-body-sm font-medium text-inv-grey-700">
          {{ L }}
          @if (required()) {
            <span class="text-inv-error-100" aria-hidden="true">&nbsp;*</span>
          }
        </label>
      }
      <div class="app-form-field__control">
        <ng-content />
      </div>
      @if (errorMessage(); as err) {
        <small class="app-form-field__error text-inv-body-mini font-medium text-inv-error-100" role="alert">
          {{ err }}
        </small>
      }
    </div>
  `,
  styleUrl: './form-field.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block w-full' }
})
export class FormFieldComponent {
  readonly label = input<string>();
  readonly forId = input<string>('');
  readonly required = input(false);
  readonly errorMessage = input<string | null>(null);
}
