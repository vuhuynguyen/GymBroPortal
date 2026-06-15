import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { AbstractControl, FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import type { MenuItem } from 'primeng/api';
import { Menu } from 'primeng/menu';
import { Tooltip } from 'primeng/tooltip';
import { distinctUntilChanged, map, merge, startWith } from 'rxjs';
import {
  ButtonComponent,
  PageContainerComponent,
  PageStickyFooterComponent,
  PanelCardComponent
} from '../../../../shared/ui';
import { uuid } from '../../../../shared/uuid';
import { TenantService } from '../../../../core/tenant/tenant';
import { ExerciseService } from '../../../exercises/exercise';
import {
  hasRequiredMetric,
  requiredMetricMessage,
  trackingProfile
} from '../../../exercises/exercise-tracking';
import { WorkoutPlanService } from '../workout-plan.service';
import type {
  PlanSetDetailDto,
  PlanSetTypeApi,
  PlanWorkoutStructureRequest,
  WorkoutPlanDetailDto
} from '../workout-plan.model';
import {
  ExercisePickerPanelComponent,
  type ExercisePickerAddPayload
} from '../exercise-picker-panel/exercise-picker-panel';
import {
  PlanDetailsFormDialogComponent,
  type PlanDetailsFormValue
} from '../plan-details-form-dialog/plan-details-form-dialog';
import { PLAN_BUILDER_SET_TYPE_OPTIONS } from './plan-set-options';
import { computePlanMetaChips, parseIntSafe, parsePlanMeta } from './plan-meta';

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
    ButtonComponent,
    PageStickyFooterComponent,
    ExercisePickerPanelComponent,
    PlanDetailsFormDialogComponent,
    Menu,
    Tooltip,
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
  private readonly location = inject(Location);
  private readonly workoutPlanService = inject(WorkoutPlanService);
  private readonly exerciseService = inject(ExerciseService);
  private readonly tenantService = inject(TenantService);
  private readonly messageService = inject(MessageService);

  readonly planId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly publishing = signal(false);
  readonly canEdit = computed(() => this.tenantService.currentRole() === 'Owner');

  /** Publish state for the current head: edits land on a draft, only "Publish" advances the live version. */
  readonly version = signal<number | null>(null);
  readonly isDraft = signal(false);
  readonly latestPublishedVersion = signal<number | null>(null);

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

  /**
   * Builder exercises start EXPANDED (you're editing their sets); this holds the ones the user has
   * collapsed to tidy a long workout. Keyed `workoutIndex:exerciseIndex`.
   */
  readonly collapsedExercises = signal<ReadonlySet<string>>(new Set());

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
      map(() =>
        computePlanMetaChips(this.form.get('durationWeeks')?.value, this.form.get('workoutsPerWeek')?.value)
      )
    ),
    { initialValue: [] as { icon: string; label: string }[] }
  );

  /** Sidebar summary totals (reads chip signal so totals update on nested form changes). */
  readonly planSummary = computed(() => {
    void this.planMetaChips();
    let totalEx = 0;
    const wLen = this.workouts().length;
    for (let wi = 0; wi < wLen; wi++) totalEx += this.exercisesAt(wi).length;
    const dw = parseIntSafe(this.form.get('durationWeeks')?.value);
    const pw = parseIntSafe(this.form.get('workoutsPerWeek')?.value);
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
    // Load the whole catalog (cap is 500 server-side) so every plan exercise can be named and the picker
    // can surface all of them — a smaller page left later catalog entries unnamed/unsearchable.
    this.exerciseService.load('', 500);

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

  readonly setTypeOptions = PLAN_BUILDER_SET_TYPE_OPTIONS;

  /** One prescribed set form group — fields mirror PlanSetRequest. */
  private createSetGroup(seed?: Partial<PlanSetDetailDto>): FormGroup {
    return this.fb.group({
      key: [uuid()],
      setType: [(seed?.setType as PlanSetTypeApi | undefined) ?? 'working', Validators.required],
      // Reps is no longer required — cardio/timed/HIIT prescribe duration/distance/rounds instead.
      targetReps: [seed?.targetReps ?? 10, [Validators.min(1), Validators.max(99)]],
      targetWeightKg: [seed?.targetWeightKg ?? null, [Validators.min(0)]],
      targetRpe: [seed?.targetRpe ?? null, [Validators.min(1), Validators.max(10)]],
      targetDurationSeconds: [seed?.targetDurationSeconds ?? null, [Validators.min(1)]],
      targetDistanceM: [seed?.targetDistanceM ?? null, [Validators.min(1)]],
      targetRounds: [seed?.targetRounds ?? null, [Validators.min(1)]],
      restSeconds: [seed?.restSeconds ?? 60, [Validators.required, Validators.min(0), Validators.max(600)]]
    });
  }

  /** Tracking profile for the exercise on a builder row — drives which target inputs to show. */
  exerciseProfileAt(workoutIndex: number, exerciseIndex: number) {
    const exerciseId = this.exercisesAt(workoutIndex).at(exerciseIndex)?.get('exerciseId')?.value as
      | string
      | undefined;
    const meta = exerciseId ? this.exercises().find((e) => e.id === exerciseId) : undefined;
    return trackingProfile(meta?.trackingType);
  }

  /**
   * The two mode-aware metric columns for an exercise's set rows (label + bound form control).
   * Strength → Reps/Weight; Cardio → Duration/Distance; Timed → Duration (one column); HIIT → Rounds/Duration.
   * Keeps the set grid to the relevant fields instead of always showing Reps/Weight + an extra line.
   */
  metricColumnsAt(
    workoutIndex: number,
    exerciseIndex: number
  ): { label: string; control: string; max: number | null }[] {
    switch (this.exerciseProfileAt(workoutIndex, exerciseIndex).type) {
      case 'Cardio':
        return [
          { label: 'Duration s', control: 'targetDurationSeconds', max: null },
          { label: 'Distance m', control: 'targetDistanceM', max: null }
        ];
      case 'Timed':
        return [{ label: 'Duration s', control: 'targetDurationSeconds', max: null }];
      case 'Hiit':
        return [
          { label: 'Rounds', control: 'targetRounds', max: null },
          { label: 'Work s', control: 'targetDurationSeconds', max: null }
        ];
      case 'Mobility':
        return [
          { label: 'Duration s', control: 'targetDurationSeconds', max: null },
          { label: 'Reps', control: 'targetReps', max: 99 }
        ];
      default:
        return [
          { label: 'Reps', control: 'targetReps', max: 99 },
          { label: 'Weight', control: 'targetWeightKg', max: null }
        ];
    }
  }

  /** Builds a form group for an exercise row with a per-set FormArray. */
  private createExerciseGroup(
    exerciseId: string,
    sets: ReadonlyArray<Partial<PlanSetDetailDto>> = [],
    supersetGroupId: string | null = null,
    exerciseName: string | null = null
  ): FormGroup {
    const seedSets = sets.length > 0 ? sets : [{}, {}, {}]; // default 3 working sets
    const setGroups = seedSets.map((s) => this.createSetGroup(s));
    return this.fb.group({
      key: [uuid()],
      exerciseId: [exerciseId, Validators.required],
      // Name resolved server-side (uncapped) and cached on the group so display never depends on the
      // client catalog page — which is capped, so large catalogs would otherwise show "Exercise".
      exerciseName: this.fb.control<string | null>(exerciseName),
      supersetGroupId: this.fb.control<string | null>(supersetGroupId),
      sets: this.fb.array<FormGroup>(setGroups, [Validators.required, Validators.minLength(1)])
    });
  }

  /** True when this exercise is supersetted with the one directly above it (same group id). */
  isSupersetLinked(workoutIndex: number, exerciseIndex: number): boolean {
    if (exerciseIndex === 0) return false;
    const exArr = this.exercisesAt(workoutIndex);
    const cur = exArr.at(exerciseIndex).get('supersetGroupId')?.value;
    const prev = exArr.at(exerciseIndex - 1).get('supersetGroupId')?.value;
    return !!cur && cur === prev;
  }

  /** Link/unlink this exercise into a superset with the exercise above it. */
  toggleSuperset(workoutIndex: number, exerciseIndex: number): void {
    if (!this.canEdit() || exerciseIndex === 0) return;
    const exArr = this.exercisesAt(workoutIndex);
    const cur = exArr.at(exerciseIndex);
    const prev = exArr.at(exerciseIndex - 1);
    if (this.isSupersetLinked(workoutIndex, exerciseIndex)) {
      cur.get('supersetGroupId')?.setValue(null);
    } else {
      const group = (prev.get('supersetGroupId')?.value as string | null) ?? uuid();
      prev.get('supersetGroupId')?.setValue(group);
      cur.get('supersetGroupId')?.setValue(group);
    }
    this.form.markAsDirty();
  }

  setsAt(workoutIndex: number, exerciseIndex: number): FormArray<FormGroup> {
    return this.exercisesAt(workoutIndex).at(exerciseIndex).get('sets') as FormArray<FormGroup>;
  }

  addSet(workoutIndex: number, exerciseIndex: number): void {
    if (!this.canEdit()) return;
    const sets = this.setsAt(workoutIndex, exerciseIndex);
    if (sets.length >= 20) return;
    // Duplicate the last set's targets if available so adding a set is a one-click action.
    const last = sets.length > 0 ? (sets.at(sets.length - 1).value as Record<string, unknown>) : null;
    sets.push(
      this.createSetGroup(
        last
          ? {
              setType: last['setType'] as PlanSetTypeApi,
              targetReps: last['targetReps'] as number | null,
              targetWeightKg: last['targetWeightKg'] as number | null,
              targetRpe: last['targetRpe'] as number | null,
              targetDurationSeconds: last['targetDurationSeconds'] as number | null,
              targetDistanceM: last['targetDistanceM'] as number | null,
              targetRounds: last['targetRounds'] as number | null,
              restSeconds: last['restSeconds'] as number
            }
          : {}
      )
    );
    this.form.markAsDirty();
  }

  removeSet(workoutIndex: number, exerciseIndex: number, setIndex: number): void {
    if (!this.canEdit()) return;
    const sets = this.setsAt(workoutIndex, exerciseIndex);
    if (sets.length <= 1) return; // keep at least one
    sets.removeAt(setIndex);
    this.form.markAsDirty();
  }

  duplicateSet(workoutIndex: number, exerciseIndex: number, setIndex: number): void {
    if (!this.canEdit()) return;
    const sets = this.setsAt(workoutIndex, exerciseIndex);
    if (sets.length >= 20) return;
    const src = sets.at(setIndex).value as Record<string, unknown>;
    sets.insert(
      setIndex + 1,
      this.createSetGroup({
        setType: src['setType'] as PlanSetTypeApi,
        targetReps: src['targetReps'] as number | null,
        targetWeightKg: src['targetWeightKg'] as number | null,
        targetRpe: src['targetRpe'] as number | null,
        targetDurationSeconds: src['targetDurationSeconds'] as number | null,
        targetDistanceM: src['targetDistanceM'] as number | null,
        targetRounds: src['targetRounds'] as number | null,
        restSeconds: src['restSeconds'] as number
      })
    );
    this.form.markAsDirty();
  }

  /** Reorder sets within an exercise by dragging the row handle (mirrors workout drag-drop). */
  onSetsDropped(workoutIndex: number, exerciseIndex: number, event: CdkDragDrop<unknown>): void {
    if (!this.canEdit() || event.previousIndex === event.currentIndex) return;
    const sets = this.setsAt(workoutIndex, exerciseIndex);
    moveItemInArray(sets.controls, event.previousIndex, event.currentIndex);
    sets.updateValueAndValidity();
    this.form.markAsDirty();
  }

  setTrackKey(_index: number, group: AbstractControl): string {
    const k = (group as FormGroup).get('key')?.value;
    return typeof k === 'string' ? k : `set-${_index}`;
  }

  private createWorkoutGroup(name = ''): FormGroup {
    return this.fb.group({
      key: [uuid()],
      name: [name, [Validators.required, Validators.maxLength(120)]],
      exercises: this.fb.array<FormGroup>([])
    });
  }

  private loadPlan(id: string): void {
    this.loading.set(true);
    // Load the LATEST version of this template: the route id may point at an older version (e.g. a stale
    // bookmark/tab), and edits must target the latest or the save 409s. adoptVersionId re-points the URL.
    this.workoutPlanService.getLatest(id).subscribe({
      next: (dto) => {
        this.adoptVersionId(dto.id);
        this.patchFromDto(dto);
      },
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

    this.version.set(dto.version);
    this.isDraft.set(dto.isDraft);
    this.latestPublishedVersion.set(dto.latestPublishedVersion);

    this.planDetailsDialogOpen.set(false);

    const wArr = this.workouts();
    wArr.clear();

    for (const w of [...dto.workouts].sort((a, b) => a.order - b.order)) {
      const wg = this.createWorkoutGroup(w.name);
      const exArr = wg.get('exercises') as FormArray<FormGroup>;
      for (const ex of [...w.exercises].sort((a, b) => a.order - b.order)) {
        const sortedSets = [...(ex.sets ?? [])].sort((a, b) => a.order - b.order);
        exArr.push(this.createExerciseGroup(ex.exerciseId, sortedSets, ex.supersetGroupId ?? null, ex.exerciseName ?? null));
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

  isExerciseExpanded(workoutIndex: number, exerciseIndex: number): boolean {
    return !this.collapsedExercises().has(`${workoutIndex}:${exerciseIndex}`);
  }

  toggleExerciseExpanded(workoutIndex: number, exerciseIndex: number): void {
    const key = `${workoutIndex}:${exerciseIndex}`;
    const next = new Set(this.collapsedExercises());
    next.has(key) ? next.delete(key) : next.add(key);
    this.collapsedExercises.set(next);
  }

  workoutCollapsedPreview(workoutIndex: number): string {
    const arr = this.exercisesAt(workoutIndex);
    if (arr.length === 0) return 'No exercises yet';
    const bits: string[] = [];
    const cap = 3;
    for (let i = 0; i < Math.min(cap, arr.length); i++) {
      bits.push(this.exerciseLabel(arr.at(i)));
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
    // Cache the just-picked name so it survives even if the catalog page later evicts it.
    const name = this.exercises().find((e) => e.id === payload.exerciseId)?.name ?? null;
    this.exercisesAt(wi).push(this.createExerciseGroup(payload.exerciseId, payload.sets, null, name));
    if (!payload.addAnother) this.cancelPicker();
  }

  /** Display name for an exercise form group: cached server name first, then catalog, then fallback. */
  exerciseLabel(group: AbstractControl): string {
    const cached = ((group as FormGroup).get('exerciseName')?.value as string | null)?.trim();
    if (cached) return cached;
    return this.exerciseNameForId((group as FormGroup).get('exerciseId')?.value);
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

  /**
   * Every successful edit forks a new immutable plan version with a new id; re-point this page to it so the
   * NEXT save targets the latest version instead of a now-stale id (which the API rejects with 409). The URL
   * is swapped in place (no router navigation, so the form/scroll state is preserved and no reload fires).
   */
  private adoptVersionId(newId: string | null | undefined): void {
    if (!newId || newId === this.planId()) return;
    this.planId.set(newId);
    this.location.replaceState(`/workspace/plans/${newId}`);
  }

  private persistPlanHeaderToServer(): void {
    const id = this.planId();
    if (!id || !this.canEdit()) return;
    const name = (this.form.get('name')?.value ?? '').toString().trim();
    if (!name) return;
    const meta = parsePlanMeta(this.form.value.durationWeeks, this.form.value.workoutsPerWeek);
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
        next: (ref) => {
          this.adoptVersionId(ref.id);
          // The edit landed on the draft head — there are now unpublished changes.
          this.isDraft.set(true);
        },
        error: (err: { error?: unknown }) => {
          const msg = typeof err?.error === 'string' ? err.error : 'Could not save plan details.';
          this.messageService.add({ severity: 'error', summary: 'Update failed', detail: msg });
        }
      });
  }

  onCancel(): void {
    void this.router.navigate(['/workspace/plans']);
  }

  private static readonly FIELD_LABELS: Record<string, string> = {
    targetReps: 'reps',
    targetWeightKg: 'weight',
    targetRpe: 'RPE',
    targetDurationSeconds: 'duration',
    targetDistanceM: 'distance',
    targetRounds: 'rounds',
    restSeconds: 'rest'
  };

  /** Walks the form to name the first invalid field, so the warning points to exactly what to fix. */
  private describeFirstInvalid(): string | null {
    if (this.form.get('name')?.invalid) return 'Plan name is required.';
    const workouts = this.workouts();
    for (let wi = 0; wi < workouts.length; wi++) {
      const w = workouts.at(wi);
      const wName = ((w.get('name')?.value as string) || '').trim() || `Workout ${wi + 1}`;
      if (w.get('name')?.invalid) return `“${wName}”: workout name is required.`;
      const exs = this.exercisesAt(wi);
      for (let ei = 0; ei < exs.length; ei++) {
        const e = exs.at(ei);
        if (e.get('exerciseId')?.invalid) return `“${wName}” · exercise ${ei + 1}: pick an exercise.`;
        const sets = this.setsAt(wi, ei);
        for (let si = 0; si < sets.length; si++) {
          const sg = sets.at(si) as FormGroup;
          if (sg.invalid) {
            const bad = Object.keys(sg.controls).find((k) => sg.get(k)?.invalid);
            const label = (bad && PlanBuilderComponent.FIELD_LABELS[bad]) || 'a value';
            return `“${wName}” · exercise ${ei + 1} · set ${si + 1}: check ${label}.`;
          }
        }
      }
    }
    return null;
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
        detail: this.describeFirstInvalid() ?? 'Fix the highlighted field before saving.'
      });
      return;
    }

    const meta = parsePlanMeta(this.form.value.durationWeeks, this.form.value.workoutsPerWeek);
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

    // Metadata + structure go in ONE request so the save lands as a single new version. (Two version-forking
    // PUTs would make the second target a now-stale id → 409.) Re-point to the returned latest-version id.
    this.workoutPlanService
      .replaceStructure(id, {
        name: this.form.value.name!.trim(),
        description: (this.form.value.description ?? '').trim() || null,
        durationWeeks: meta.durationWeeks,
        workoutsPerWeek: meta.workoutsPerWeek,
        workouts: structure.workouts!
      })
      .subscribe({
        next: (ref) => {
          this.saving.set(false);
          this.adoptVersionId(ref.id);
          // The save landed on the draft head — there are now unpublished changes to publish.
          this.isDraft.set(true);
          this.form.markAsPristine();
          this.messageService.add({
            severity: 'success',
            summary: 'Draft saved',
            detail: 'Saved as a draft. Publish to push it to assigned trainees.'
          });
        },
        error: (err: { error?: unknown }) => {
          this.saving.set(false);
          const msg = typeof err?.error === 'string' ? err.error : 'Save failed.';
          this.messageService.add({ severity: 'error', summary: 'Save failed', detail: msg });
        }
      });
  }

  /**
   * Publishes the draft head — the only action that advances the version trainees/assignments see. Requires the
   * form to be saved first (unsaved edits aren't on the server yet), and only fires when there's a draft to publish.
   */
  publishPlan(): void {
    if (!this.canEdit()) return;
    const id = this.planId();
    if (!id) return;
    if (this.hasUnsavedChanges()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Save first',
        detail: 'Save your changes before publishing.'
      });
      return;
    }
    if (!this.isDraft()) return;

    this.publishing.set(true);
    this.workoutPlanService.publish(id).subscribe({
      next: ({ version }) => {
        this.publishing.set(false);
        this.version.set(version);
        this.latestPublishedVersion.set(version);
        this.isDraft.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Published',
          detail: `Published as v${version}. Assigned trainees can now move to this version.`
        });
      },
      error: (err: { error?: unknown }) => {
        this.publishing.set(false);
        const msg = typeof err?.error === 'string' ? err.error : 'Publish failed.';
        this.messageService.add({ severity: 'error', summary: 'Publish failed', detail: msg });
      }
    });
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

        const setsArr = eg.get('sets') as FormArray<FormGroup>;
        if (!setsArr || setsArr.length < 1 || setsArr.length > 20) {
          return {
            workouts: null,
            error: `Each exercise must have between 1 and 20 sets on "${name}".`
          };
        }

        // The exercise's tracking mode decides which target metrics are meaningful/required for its sets.
        const profile = trackingProfile(
          this.exercises().find((e) => e.id === exerciseId)?.trackingType
        );

        const num = (v: unknown): number | null => (v === '' || v == null ? null : Number(v));

        const prescribedSets = [];
        for (let si = 0; si < setsArr.length; si++) {
          const sg = setsArr.at(si);
          const setType = (sg.get('setType')?.value as PlanSetTypeApi) ?? 'working';
          const reps = num(sg.get('targetReps')?.value);
          const restSeconds = Number(sg.get('restSeconds')?.value);
          const targetWeightKg = num(sg.get('targetWeightKg')?.value);
          const targetDurationSeconds = num(sg.get('targetDurationSeconds')?.value);
          const targetDistanceM = num(sg.get('targetDistanceM')?.value);
          const targetRounds = num(sg.get('targetRounds')?.value);
          const rawRpe = sg.get('targetRpe')?.value;

          // Mode-aware required-metric rule (replaces the old "reps ≥ 1" blanket): a strength set needs reps,
          // a cardio set duration/distance, a HIIT set rounds/duration; mobility needs none.
          if (!hasRequiredMetric(profile.type, {
            reps,
            weightKg: targetWeightKg,
            durationSeconds: targetDurationSeconds,
            distanceM: targetDistanceM,
            rounds: targetRounds,
            isCompleted: false
          })) {
            return { workouts: null, error: `Set ${si + 1} of an exercise on "${name}": ${requiredMetricMessage(profile.type)}` };
          }
          if (reps != null && (!Number.isFinite(reps) || reps < 1)) {
            return { workouts: null, error: `Set ${si + 1} of an exercise on "${name}": reps must be at least 1.` };
          }
          if (!Number.isFinite(restSeconds) || restSeconds < 0) {
            return { workouts: null, error: `Set ${si + 1} of an exercise on "${name}": rest must be 0 or more.` };
          }
          if (targetWeightKg != null && (!Number.isFinite(targetWeightKg) || targetWeightKg < 0)) {
            return { workouts: null, error: `Set ${si + 1} of an exercise on "${name}": weight must be 0 or more.` };
          }

          // RPE is stored server-side as an integer (1–10); round so a stray decimal never 400s on save.
          const targetRpe = rawRpe === '' || rawRpe == null ? null : Math.round(Number(rawRpe));
          if (targetRpe != null && (!Number.isFinite(targetRpe) || targetRpe < 1 || targetRpe > 10)) {
            return { workouts: null, error: `Set ${si + 1} of an exercise on "${name}": RPE must be between 1 and 10.` };
          }

          // Persist only the metrics this exercise's mode actually uses, so a cardio set never carries a
          // stray reps/weight (and a strength set never carries duration). RPE + rest apply to every mode.
          const keep = profile.targetFields;
          prescribedSets.push({
            setType,
            targetReps: keep.includes('reps') ? reps : null,
            targetWeightKg: keep.includes('weight') ? targetWeightKg : null,
            targetRpe,
            targetDurationSeconds: keep.includes('duration') ? targetDurationSeconds : null,
            targetDistanceM: keep.includes('distance') ? targetDistanceM : null,
            targetRounds: keep.includes('rounds') ? targetRounds : null,
            restSeconds,
            order: si + 1
          });
        }

        exercises.push({
          exerciseId,
          order: ei + 1,
          sets: prescribedSets,
          supersetGroupId: (eg.get('supersetGroupId')?.value as string | null) ?? null
        });
      }

      workouts.push({ name, order: wi + 1, exercises });
    }

    return { workouts, error: null };
  }
}
