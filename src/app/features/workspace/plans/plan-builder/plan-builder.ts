import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { concatMap, distinctUntilChanged, map, merge, startWith } from 'rxjs';
import {
  ButtonComponent,
  InputComponent,
  PageContainerComponent,
  PageStickyFooterComponent,
  PanelCardComponent
} from '../../../../shared/ui';
import { TenantService } from '../../../../core/tenant/tenant';
import { ExerciseService } from '../../../exercises/exercise';
import { WorkoutPlanService } from '../workout-plan.service';
import type { PlanWorkoutStructureRequest, WorkoutPlanDetailDto } from '../workout-plan.model';
import {
  ExercisePickerPanelComponent,
  type ExercisePickerAddPayload
} from '../exercise-picker-panel/exercise-picker-panel';
import {
  PlanDetailsFormDialogComponent,
  type PlanDetailsFormValue
} from '../plan-details-form-dialog/plan-details-form-dialog';

/**
 * Workout plan builder — carded workouts + exercise table, meta chips, plan details dialog (pencil).
 */
@Component({
  selector: 'app-plan-builder',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageContainerComponent,
    PanelCardComponent,
    InputComponent,
    ButtonComponent,
    PageStickyFooterComponent,
    ExercisePickerPanelComponent,
    PlanDetailsFormDialogComponent,
    Menu,
    DragDropModule
  ],
  templateUrl: './plan-builder.html',
  styleUrl: './plan-builder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlanBuilderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly planId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly canEdit = computed(() => this.tenantService.currentRole() === 'Owner');

  readonly exercises = this.exerciseService.exercises;

  /** Which workout is currently using the slide-over picker panel (null = closed). */
  readonly pickerWorkoutIndex = signal<number | null>(null);

  readonly planDetailsDialogOpen = signal(false);
  readonly planDetailsDialogSeed = signal(0);
  readonly planDetailsDialogSnapshot = signal<PlanDetailsFormValue>({
    name: '',
    description: '',
    durationWeeks: '',
    workoutsPerWeek: ''
  });

  readonly workoutMenu = viewChild<Menu>('workoutMenu');

  readonly workoutMenuModel = signal<MenuItem[]>([]);

  /** Single-open accordion index for workouts; -1 when everything is collapsed. */
  readonly expandedWorkoutIndex = signal(-1);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.maxLength(2000)]],
    durationWeeks: [''],
    workoutsPerWeek: [''],
    workouts: this.fb.array<FormGroup>([])
  });

  /** Tracks `form.dirty` via value, status, and unified `events` (dirty/pristine). */
  readonly hasUnsavedChanges = toSignal(
    merge(
      this.form.valueChanges.pipe(map(() => this.form.dirty)),
      this.form.statusChanges.pipe(map(() => this.form.dirty)),
      this.form.events.pipe(map(() => this.form.dirty))
    ).pipe(distinctUntilChanged()),
    { initialValue: false }
  );

  /** Valid meta chips under the plan name; mirrors save-time bounds. */
  readonly planMetaChips = toSignal(
    this.form.valueChanges.pipe(
      startWith(this.form.value),
      map(() => this.computePlanMetaChips())
    ),
    { initialValue: [] as { icon: string; label: string }[] }
  );

  /** Sidebar summary totals (reads chip signal so totals update on nested form changes). */
  readonly planSummary = computed(() => {
    void this.planMetaChips();
    let totalEx = 0;
    const wLen = this.workouts().length;
    for (let wi = 0; wi < wLen; wi++) totalEx += this.exercisesAt(wi).length;
    const dw = this.parseIntSafe(this.form.get('durationWeeks')?.value);
    const pw = this.parseIntSafe(this.form.get('workoutsPerWeek')?.value);
    return {
      durationWeeks: dw,
      workoutsPerWeek: pw,
      totalWorkouts: wLen,
      totalExercises: totalEx
    };
  });

  /** Workout being targeted by the picker, exposed for the panel's header context. */
  readonly pickerTargetName = computed(() => {
    const wi = this.pickerWorkoutIndex();
    if (wi == null) return null;
    const g = this.workouts().at(wi);
    return ((g?.get('name')?.value as string) || '').trim() || null;
  });

  constructor() {
    this.exerciseService.load('', 200);

    this.route.paramMap.pipe(takeUntilDestroyed(), map((p) => p.get('planId'))).subscribe((id) => {
      this.planId.set(id);
      if (id) this.loadPlan(id);
    });
  }

  workouts(): FormArray {
    return this.form.get('workouts') as FormArray<FormGroup>;
  }

  exercisesAt(workoutIndex: number): FormArray {
    return this.workouts().at(workoutIndex).get('exercises') as FormArray<FormGroup>;
  }

  /** Builds a form group for an exercise row. Always has a concrete exerciseId now. */
  private createExerciseGroup(
    exerciseId: string,
    sets = 3,
    reps = 10,
    restSeconds = 60
  ): FormGroup {
    return this.fb.group({
      key: [crypto.randomUUID()],
      exerciseId: [exerciseId, Validators.required],
      sets: [sets, [Validators.required, Validators.min(1)]],
      reps: [reps, [Validators.required, Validators.min(1)]],
      restSeconds: [restSeconds, [Validators.required, Validators.min(0)]]
    });
  }

  private createWorkoutGroup(name = ''): FormGroup {
    return this.fb.group({
      key: [crypto.randomUUID()],
      name: [name, [Validators.required, Validators.maxLength(120)]],
      exercises: this.fb.array<FormGroup>([])
    });
  }

  private loadPlan(id: string): void {
    this.loading.set(true);
    this.workoutPlanService.get(id).subscribe({
      next: (dto) => this.patchFromDto(dto),
      error: () => {
        this.loading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Could not load plan',
          detail: 'It may have been removed or you may not have access.'
        });
      }
    });
  }

  private patchFromDto(dto: WorkoutPlanDetailDto): void {
    this.form.patchValue({
      name: dto.name,
      description: dto.description ?? '',
      durationWeeks: dto.durationWeeks != null ? String(dto.durationWeeks) : '',
      workoutsPerWeek: dto.workoutsPerWeek != null ? String(dto.workoutsPerWeek) : ''
    });

    this.planDetailsDialogOpen.set(false);

    const wArr = this.workouts();
    wArr.clear();

    for (const w of [...dto.workouts].sort((a, b) => a.order - b.order)) {
      const wg = this.createWorkoutGroup(w.name);
      const exArr = wg.get('exercises') as FormArray<FormGroup>;
      for (const ex of [...w.exercises].sort((a, b) => a.order - b.order)) {
        exArr.push(this.createExerciseGroup(ex.exerciseId, ex.sets, ex.reps, ex.restSeconds));
      }
      wArr.push(wg);
    }

    this.pickerWorkoutIndex.set(null);
    this.expandedWorkoutIndex.set(wArr.length > 0 ? 0 : -1);
    this.form.markAsPristine();
    this.loading.set(false);
  }

  addWorkout(): void {
    if (!this.canEdit()) return;
    this.workouts().push(this.createWorkoutGroup(`Workout ${this.workouts().length + 1}`));
    this.expandedWorkoutIndex.set(this.workouts().length - 1);
  }

  removeWorkout(index: number): void {
    if (!this.canEdit()) return;
    this.cancelPicker();
    const exp = this.expandedWorkoutIndex();
    this.workouts().removeAt(index);
    const len = this.workouts().length;
    if (len === 0) {
      this.expandedWorkoutIndex.set(-1);
    } else if (exp === index) {
      this.expandedWorkoutIndex.set(Math.min(index, len - 1));
    } else if (exp > index) {
      this.expandedWorkoutIndex.set(exp - 1);
    }
  }

  moveWorkout(index: number, delta: number): void {
    if (!this.canEdit()) return;
    this.cancelPicker();
    const exp = this.expandedWorkoutIndex();
    const arr = this.workouts();
    const next = index + delta;
    if (next < 0 || next >= arr.length) return;
    const g = arr.at(index);
    arr.removeAt(index);
    arr.insert(next, g);
    if (exp === index) this.expandedWorkoutIndex.set(next);
    else if (exp === next) this.expandedWorkoutIndex.set(index);
  }

  workoutTrackId(_index: number, group: AbstractControl): string {
    const k = (group as FormGroup).get('key')?.value;
    return typeof k === 'string' && k.length > 0 ? k : `workout-${_index}`;
  }

  onWorkoutsDropped(event: CdkDragDrop<unknown>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) return;

    const arr = this.workouts();
    const expIdx = this.expandedWorkoutIndex();
    const expandedFg = expIdx >= 0 && expIdx < arr.length ? arr.at(expIdx) : null;
    const pi = this.pickerWorkoutIndex();
    const pickerFg = pi != null && pi < arr.length ? arr.at(pi) : null;

    moveItemInArray(arr.controls, event.previousIndex, event.currentIndex);

    if (expandedFg) {
      const ni = arr.controls.indexOf(expandedFg);
      if (ni >= 0) this.expandedWorkoutIndex.set(ni);
    }
    if (pickerFg) {
      const ni = arr.controls.indexOf(pickerFg);
      if (ni >= 0) this.pickerWorkoutIndex.set(ni);
    }
    this.form.markAsDirty();
  }

  isWorkoutExpanded(workoutIndex: number): boolean {
    return this.expandedWorkoutIndex() === workoutIndex;
  }

  toggleWorkoutExpanded(workoutIndex: number): void {
    if (this.expandedWorkoutIndex() === workoutIndex) {
      this.expandedWorkoutIndex.set(-1);
      if (this.pickerWorkoutIndex() === workoutIndex) this.cancelPicker();
    } else {
      this.expandedWorkoutIndex.set(workoutIndex);
    }
  }

  workoutExerciseCount(workoutIndex: number): number {
    return this.exercisesAt(workoutIndex).length;
  }

  workoutCollapsedPreview(workoutIndex: number): string {
    const arr = this.exercisesAt(workoutIndex);
    if (arr.length === 0) return 'No exercises yet';
    const bits: string[] = [];
    const cap = 3;
    for (let i = 0; i < Math.min(cap, arr.length); i++) {
      const id = (arr.at(i).get('exerciseId')?.value as string) ?? '';
      bits.push(this.exerciseNameForId(id));
    }
    if (arr.length > cap) bits.push('…');
    return bits.join(' · ');
  }

  openExercisePicker(workoutIndex: number): void {
    if (!this.canEdit()) return;
    this.expandedWorkoutIndex.set(workoutIndex);
    this.pickerWorkoutIndex.set(workoutIndex);
  }

  cancelPicker(): void {
    this.pickerWorkoutIndex.set(null);
  }

  onExerciseAdded(payload: ExercisePickerAddPayload): void {
    const wi = this.pickerWorkoutIndex();
    if (wi == null || !this.canEdit()) return;
    this.exercisesAt(wi).push(
      this.createExerciseGroup(payload.exerciseId, payload.sets, payload.reps, payload.restSeconds)
    );
    if (!payload.addAnother) this.cancelPicker();
  }

  exerciseNameForId(exerciseId: string | null | undefined): string {
    const id = (exerciseId ?? '').trim();
    if (!id) return 'Pick exercise';
    return this.exercises().find((e) => e.id === id)?.name ?? 'Exercise';
  }

  exerciseImageForId(exerciseId: string | null | undefined): string | null {
    const id = (exerciseId ?? '').trim();
    if (!id) return null;
    return this.exercises().find((e) => e.id === id)?.imageUrl ?? null;
  }

  exerciseMuscleForId(exerciseId: string | null | undefined): string | null {
    const id = (exerciseId ?? '').trim();
    if (!id) return null;
    return this.exercises().find((e) => e.id === id)?.muscleGroup ?? null;
  }

  removeExercise(workoutIndex: number, exerciseIndex: number): void {
    if (!this.canEdit()) return;
    this.exercisesAt(workoutIndex).removeAt(exerciseIndex);
  }

  moveExercise(workoutIndex: number, exerciseIndex: number, delta: number): void {
    if (!this.canEdit()) return;
    const arr = this.exercisesAt(workoutIndex);
    const next = exerciseIndex + delta;
    if (next < 0 || next >= arr.length) return;
    const g = arr.at(exerciseIndex);
    arr.removeAt(exerciseIndex);
    arr.insert(next, g);
  }

  openPlanDetailsDialog(): void {
    if (!this.canEdit()) return;
    this.planDetailsDialogSnapshot.set({
      name: (this.form.get('name')?.value ?? '').toString(),
      description: (this.form.get('description')?.value ?? '').toString(),
      durationWeeks: (this.form.get('durationWeeks')?.value ?? '').toString(),
      workoutsPerWeek: (this.form.get('workoutsPerWeek')?.value ?? '').toString()
    });
    this.planDetailsDialogSeed.update((n) => n + 1);
    this.planDetailsDialogOpen.set(true);
  }

  onPlanDetailsDialogSaved(v: PlanDetailsFormValue): void {
    if (!this.canEdit()) return;
    this.form.patchValue({
      name: v.name,
      description: v.description,
      durationWeeks: v.durationWeeks,
      workoutsPerWeek: v.workoutsPerWeek
    });
    this.form.markAsDirty();
    this.persistPlanHeaderToServer();
    this.planDetailsDialogOpen.set(false);
  }

  openWorkoutMenu(event: Event, wi: number): void {
    if (!this.canEdit()) return;
    this.workoutMenuModel.set(this.buildWorkoutMenuItems(wi));
    queueMicrotask(() => this.workoutMenu()?.toggle(event));
  }

  private buildWorkoutMenuItems(wi: number): MenuItem[] {
    const len = this.workouts().length;
    return [
      {
        label: 'Move up',
        icon: 'pi pi-arrow-up',
        disabled: wi === 0,
        command: () => this.moveWorkout(wi, -1)
      },
      {
        label: 'Move down',
        icon: 'pi pi-arrow-down',
        disabled: wi === len - 1,
        command: () => this.moveWorkout(wi, 1)
      },
      {
        label: 'Delete',
        icon: 'pi pi-trash',
        styleClass: 'text-red-600',
        command: () => this.removeWorkout(wi)
      }
    ];
  }

  browseTemplates(): void {
    void this.router.navigate(['/workspace/plans']);
  }

  private persistPlanHeaderToServer(): void {
    const id = this.planId();
    if (!id || !this.canEdit()) return;
    const name = (this.form.get('name')?.value ?? '').toString().trim();
    if (!name) return;
    const meta = this.parseMeta();
    if (meta.error) {
      this.messageService.add({ severity: 'warn', summary: 'Invalid values', detail: meta.error });
      return;
    }
    this.workoutPlanService
      .update(id, {
        name,
        description: (this.form.get('description')?.value ?? '').toString().trim() || null,
        durationWeeks: meta.durationWeeks,
        workoutsPerWeek: meta.workoutsPerWeek
      })
      .subscribe({
        error: (err: { error?: unknown }) => {
          const msg = typeof err?.error === 'string' ? err.error : 'Could not save plan details.';
          this.messageService.add({ severity: 'error', summary: 'Update failed', detail: msg });
        }
      });
  }

  onCancel(): void {
    void this.router.navigate(['/workspace/plans']);
  }

  savePlan(): void {
    if (!this.canEdit()) return;
    const id = this.planId();
    if (!id) return;

    this.form.markAllAsTouched();
    if (this.form.invalid) {
      if (this.form.get('name')?.invalid) {
        this.openPlanDetailsDialog();
      }
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: 'Fix validation errors before saving.'
      });
      return;
    }

    const meta = this.parseMeta();
    if (meta.error) {
      this.openPlanDetailsDialog();
      this.messageService.add({ severity: 'warn', summary: 'Invalid values', detail: meta.error });
      return;
    }

    const structure = this.buildStructurePayload();
    if (structure.error) {
      this.messageService.add({ severity: 'warn', summary: 'Structure', detail: structure.error });
      return;
    }

    this.saving.set(true);

    this.workoutPlanService
      .update(id, {
        name: this.form.value.name!.trim(),
        description: (this.form.value.description ?? '').trim() || null,
        durationWeeks: meta.durationWeeks,
        workoutsPerWeek: meta.workoutsPerWeek
      })
      .pipe(concatMap(() => this.workoutPlanService.replaceStructure(id, { workouts: structure.workouts! })))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.form.markAsPristine();
          this.messageService.add({
            severity: 'success',
            summary: 'Plan saved',
            detail: 'Changes are live for your workspace.'
          });
        },
        error: (err: { error?: unknown }) => {
          this.saving.set(false);
          const msg = typeof err?.error === 'string' ? err.error : 'Save failed.';
          this.messageService.add({ severity: 'error', summary: 'Save failed', detail: msg });
        }
      });
  }

  private parseIntSafe(v: unknown): number | null {
    const s = (v ?? '').toString().trim();
    if (!s) return null;
    const n = Number(s);
    return Number.isInteger(n) ? n : null;
  }

  private computePlanMetaChips(): { icon: string; label: string }[] {
    const chips: { icon: string; label: string }[] = [];
    const dw = this.parseIntSafe(this.form.get('durationWeeks')?.value);
    chips.push({
      icon: 'pi pi-calendar',
      label: dw != null && dw >= 1 ? `${dw} week${dw === 1 ? '' : 's'}` : '— weeks'
    });
    const pw = this.parseIntSafe(this.form.get('workoutsPerWeek')?.value);
    chips.push({
      icon: 'pi pi-bolt',
      label: pw != null && pw >= 1 ? `${pw} workouts per week` : '— per week'
    });
    chips.push({ icon: 'pi pi-tag', label: 'Template (not assigned)' });
    return chips;
  }

  private parseMeta(): {
    durationWeeks: number | null;
    workoutsPerWeek: number | null;
    error: string | null;
  } {
    const dw = (this.form.value.durationWeeks ?? '').toString().trim();
    const pw = (this.form.value.workoutsPerWeek ?? '').toString().trim();

    let durationWeeks: number | null = null;
    if (dw) {
      const n = Number(dw);
      if (!Number.isInteger(n) || n < 2 || n > 4)
        return { durationWeeks: null, workoutsPerWeek: null, error: 'Duration weeks must be between 2 and 4.' };
      durationWeeks = n;
    }

    let workoutsPerWeek: number | null = null;
    if (pw) {
      const n = Number(pw);
      if (!Number.isInteger(n) || n < 3 || n > 6)
        return { durationWeeks: null, workoutsPerWeek: null, error: 'Workouts per week must be between 3 and 6.' };
      workoutsPerWeek = n;
    }

    return { durationWeeks, workoutsPerWeek, error: null };
  }

  private buildStructurePayload():
    | { workouts: PlanWorkoutStructureRequest[]; error: null }
    | { workouts: null; error: string } {
    const wArr = this.workouts();
    if (wArr.length === 0) {
      return { workouts: [], error: null };
    }

    const workouts: PlanWorkoutStructureRequest[] = [];

    for (let wi = 0; wi < wArr.length; wi++) {
      const wg = wArr.at(wi);
      const name = (wg.get('name')?.value as string)?.trim() ?? '';
      if (!name) return { workouts: null, error: 'Each workout needs a name.' };

      const exArr = wg.get('exercises') as FormArray<FormGroup>;
      if (exArr.length === 0)
        return { workouts: null, error: `Add at least one exercise to "${name}" (or remove the workout).` };

      const exercises = [];
      for (let ei = 0; ei < exArr.length; ei++) {
        const eg = exArr.at(ei);
        const exerciseId = (eg.get('exerciseId')?.value as string)?.trim() ?? '';
        if (!exerciseId) return { workouts: null, error: 'Select an exercise for every row.' };

        exercises.push({
          exerciseId,
          sets: Number(eg.get('sets')?.value),
          reps: Number(eg.get('reps')?.value),
          restSeconds: Number(eg.get('restSeconds')?.value),
          order: ei + 1
        });
      }

      workouts.push({ name, order: wi + 1, exercises });
    }

    return { workouts, error: null };
  }
}
