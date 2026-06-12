import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ButtonComponent, FormFieldComponent, InputComponent } from '../../../../shared/ui';
import type { NutritionVisibilityModeLabel } from '../../nutrition-plans/nutrition-enums';
import type {
  NutritionAssignmentSummaryDto,
  UpdateNutritionAssignmentRequest
} from '../nutrition-assignment.model';

/** Edit slide-over for a nutrition assignment — clone of `assignment-edit-panel` (date range + visibility). */
@Component({
  selector: 'app-nutrition-assignment-edit-panel',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, InputComponent, ButtonComponent],
  templateUrl: './nutrition-assignment-edit-panel.html',
  styleUrl: './nutrition-assignment-edit-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NutritionAssignmentEditPanelComponent {
  private readonly fb = new FormBuilder();
  private readonly messageService = inject(MessageService);

  readonly assignment = input<NutritionAssignmentSummaryDto | null>(null);
  readonly open = input(false);
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly saved = output<UpdateNutritionAssignmentRequest>();

  readonly form = this.fb.group({
    startDate: ['', Validators.required],
    endDate: [''],
    visibilityMode: ['Full' as NutritionVisibilityModeLabel, Validators.required],
    hideMacroTargets: [false],
    disableTraineeEditing: [false]
  });

  constructor() {
    effect(() => {
      const assignment = this.assignment();
      if (!assignment) return;
      this.form.reset({
        startDate: assignment.startDate ?? '',
        endDate: assignment.endDate ?? '',
        visibilityMode: assignment.visibilityMode,
        hideMacroTargets: assignment.hideMacroTargets,
        disableTraineeEditing: assignment.disableTraineeEditing
      });
    });
  }

  close(): void {
    this.closed.emit();
  }

  endDateError(): string | null {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;
    if (!start || !end) return null;
    return end < start ? 'End date must be on or after the start date.' : null;
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.endDateError()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: 'Fix validation errors before saving.'
      });
      return;
    }
    const value = this.form.getRawValue();
    this.saved.emit({
      startDate: value.startDate || undefined,
      endDate: value.endDate || null,
      visibilityMode: (value.visibilityMode ?? 'Full') as NutritionVisibilityModeLabel,
      hideMacroTargets: Boolean(value.hideMacroTargets),
      disableTraineeEditing: Boolean(value.disableTraineeEditing)
    });
  }
}
