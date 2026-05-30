import { ChangeDetectionStrategy, Component, effect, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ButtonComponent, FormFieldComponent, InputComponent } from '../../../../shared/ui';
import type {
  PlanAssignmentSummaryDto,
  PlanVisibilityMode,
  UpdatePlanAssignmentRequest
} from '../plan-assignment.model';

@Component({
  selector: 'app-assignment-edit-panel',
  standalone: true,
  imports: [ReactiveFormsModule, FormFieldComponent, InputComponent, ButtonComponent],
  templateUrl: './assignment-edit-panel.html',
  styleUrl: './assignment-edit-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentEditPanelComponent {
  private readonly fb = new FormBuilder();

  readonly assignment = input<PlanAssignmentSummaryDto | null>(null);
  readonly open = input(false);
  readonly saving = input(false);

  readonly closed = output<void>();
  readonly saved = output<UpdatePlanAssignmentRequest>();
  readonly applyLatest = output<void>();

  readonly form = this.fb.group({
    startDate: [''],
    frequencyDaysPerWeek: ['3', Validators.required],
    visibilityMode: ['Guided' as PlanVisibilityMode, Validators.required],
    hideExercises: [false],
    hideSetsReps: [false],
    hideFutureWorkouts: [true],
    disableTraineeEditing: [true]
  });

  readonly frequencyOptions = ['2', '3', '4', '5', '6', '7'];

  constructor() {
    effect(() => {
      const assignment = this.assignment();
      if (!assignment) return;
      this.form.reset({
        startDate: assignment.startDate ?? '',
        frequencyDaysPerWeek: String(assignment.frequencyDaysPerWeek),
        visibilityMode: assignment.visibilityMode,
        hideExercises: false,
        hideSetsReps: false,
        hideFutureWorkouts: true,
        disableTraineeEditing: true
      });
    });
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.saved.emit({
      startDate: value.startDate || undefined,
      frequencyDaysPerWeek: Number(value.frequencyDaysPerWeek),
      visibilityMode: (value.visibilityMode ?? 'Guided') as PlanVisibilityMode,
      hideExercises: Boolean(value.hideExercises),
      hideSetsReps: Boolean(value.hideSetsReps),
      hideFutureWorkouts: Boolean(value.hideFutureWorkouts),
      disableTraineeEditing: Boolean(value.disableTraineeEditing)
    });
  }
}
