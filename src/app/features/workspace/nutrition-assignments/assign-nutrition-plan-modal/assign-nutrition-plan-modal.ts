import { ChangeDetectionStrategy, Component, computed, inject, input, model, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ButtonComponent, FormFieldComponent, InputComponent } from '../../../../shared/ui';
import type { NutritionPlanSummaryDto } from '../../nutrition-plans/nutrition-plan.model';
import type { NutritionVisibilityModeLabel } from '../../nutrition-plans/nutrition-enums';
import type { MemberDto } from '../../workspace.model';
import type { CreateNutritionAssignmentRequest } from '../nutrition-assignment.model';

/** Three-step assign wizard — clone of `assign-plan-modal` with the nutrition flags/date range. */
@Component({
  selector: 'app-assign-nutrition-plan-modal',
  standalone: true,
  imports: [
    FormsModule,
    ReactiveFormsModule,
    FormFieldComponent,
    InputComponent,
    ButtonComponent
  ],
  templateUrl: './assign-nutrition-plan-modal.html',
  styleUrl: './assign-nutrition-plan-modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssignNutritionPlanModalComponent {
  private readonly fb = new FormBuilder();
  private readonly messageService = inject(MessageService);

  readonly open = model(false);
  readonly saving = input(false);
  readonly plans = input<NutritionPlanSummaryDto[]>([]);
  readonly trainees = input<MemberDto[]>([]);

  readonly confirmed = output<CreateNutritionAssignmentRequest[]>();

  readonly step = signal<1 | 2 | 3>(1);
  readonly traineeSearch = signal('');
  readonly selectedTraineeIds = signal<string[]>([]);
  readonly attemptedStep1 = signal(false);
  readonly attemptedStep2 = signal(false);
  readonly attemptedConfirm = signal(false);

  readonly form = this.fb.group({
    planId: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: [''],
    visibilityMode: ['Full' as NutritionVisibilityModeLabel, Validators.required],
    hideMacroTargets: [false],
    disableTraineeEditing: [false]
  });

  private readonly selectedPlanId = toSignal(
    this.form.controls.planId.valueChanges.pipe(startWith(this.form.controls.planId.value)),
    { initialValue: '' }
  );

  readonly visibleTrainees = computed(() => {
    const q = this.traineeSearch().trim().toLowerCase();
    const people = this.trainees();
    if (!q) return people;
    return people.filter((t) => t.name.toLowerCase().includes(q));
  });

  readonly selectedPlan = computed(
    () => this.plans().find((p) => p.id === this.selectedPlanId()) ?? null
  );
  /** Only plans with a published version are assignable — a draft-only plan must be published first. */
  readonly assignablePlans = computed(() =>
    this.plans().filter((p) => p.latestPublishedVersion !== null)
  );
  readonly selectedTraineeNames = computed(() => {
    const ids = new Set(this.selectedTraineeIds());
    return this.trainees()
      .filter((x) => ids.has(x.userId))
      .map((x) => x.name);
  });

  close(): void {
    this.open.set(false);
    this.step.set(1);
    this.traineeSearch.set('');
    this.selectedTraineeIds.set([]);
    this.attemptedStep1.set(false);
    this.attemptedStep2.set(false);
    this.attemptedConfirm.set(false);
    this.form.reset({
      planId: '',
      startDate: '',
      endDate: '',
      visibilityMode: 'Full',
      hideMacroTargets: false,
      disableTraineeEditing: false
    });
  }

  next(): void {
    if (this.step() === 1) {
      this.attemptedStep1.set(true);
      this.form.controls.planId.markAsTouched();
      if (this.form.controls.planId.invalid || this.selectedTraineeIds().length === 0) return;
      this.step.set(2);
      return;
    }
    if (this.step() === 2) {
      this.attemptedStep2.set(true);
      this.form.controls.startDate.markAsTouched();
      if (this.form.controls.startDate.invalid || this.endDateError()) return;
      this.step.set(3);
    }
  }

  back(): void {
    if (this.step() === 3) this.step.set(2);
    else if (this.step() === 2) this.step.set(1);
  }

  toggleTrainee(id: string): void {
    const current = new Set(this.selectedTraineeIds());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.selectedTraineeIds.set([...current]);
  }

  isSelected(id: string): boolean {
    return this.selectedTraineeIds().includes(id);
  }

  planError(): string | null {
    const planCtrl = this.form.controls.planId;
    const show = planCtrl.touched || this.attemptedStep1() || this.attemptedConfirm();
    if (!show || !planCtrl.invalid) return null;
    return 'Please select a plan.';
  }

  traineeError(): string | null {
    const show = this.attemptedStep1() || this.attemptedConfirm();
    if (!show || this.selectedTraineeIds().length > 0) return null;
    return 'Please choose at least one trainee.';
  }

  startDateError(): string | null {
    const startCtrl = this.form.controls.startDate;
    const show = startCtrl.touched || this.attemptedStep2() || this.attemptedConfirm();
    if (!show || !startCtrl.invalid) return null;
    return 'Please select a start date.';
  }

  endDateError(): string | null {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;
    if (!start || !end) return null;
    return end < start ? 'End date must be on or after the start date.' : null;
  }

  confirmAssignment(): void {
    this.attemptedConfirm.set(true);
    this.form.markAllAsTouched();
    if (this.form.invalid || this.selectedTraineeIds().length === 0 || this.endDateError()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: 'Select a plan, at least one trainee, and a valid date range before confirming.'
      });
      return;
    }
    const value = this.form.getRawValue();
    const payloads: CreateNutritionAssignmentRequest[] = this.selectedTraineeIds().map((traineeId) => ({
      traineeId,
      planId: value.planId ?? '',
      startDate: value.startDate ?? '',
      endDate: value.endDate || null,
      visibilityMode: (value.visibilityMode ?? 'Full') as NutritionVisibilityModeLabel,
      hideMacroTargets: Boolean(value.hideMacroTargets),
      disableTraineeEditing: Boolean(value.disableTraineeEditing)
    }));
    this.confirmed.emit(payloads);
  }
}
