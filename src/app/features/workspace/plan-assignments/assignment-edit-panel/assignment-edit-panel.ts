import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MessageService } from 'primeng/api';
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
  styleUrl: '../../shared/assignment-edit-panel.shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignmentEditPanelComponent {
  private readonly fb = new FormBuilder();
  private readonly messageService = inject(MessageService);

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
    hideFutureWorkouts: [false],
    disableTraineeEditing: [false]
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
        hideExercises: assignment.hideExercises,
        hideSetsReps: assignment.hideSetsReps,
        hideFutureWorkouts: assignment.hideFutureWorkouts,
        disableTraineeEditing: assignment.disableTraineeEditing
      });
    });
  }

  close(): void {
    this.closed.emit();
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
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
      frequencyDaysPerWeek: Number(value.frequencyDaysPerWeek),
      visibilityMode: (value.visibilityMode ?? 'Guided') as PlanVisibilityMode,
      hideExercises: Boolean(value.hideExercises),
      hideSetsReps: Boolean(value.hideSetsReps),
      hideFutureWorkouts: Boolean(value.hideFutureWorkouts),
      disableTraineeEditing: Boolean(value.disableTraineeEditing)
    });
  }
}
