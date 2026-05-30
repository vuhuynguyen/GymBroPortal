import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { maxLength, minLength, required } from '@angular/forms/signals';
import { SignalFormControl } from '@angular/forms/signals/compat';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { merge, startWith } from 'rxjs';
import { ExercisePreviewCardComponent, ExercisePreviewVm } from '../exercise-preview-card/exercise-preview-card';
import { EXERCISE_MEDIA_TYPES, MuscleGroup, SaveExerciseRequest } from '../exercise.model';
import { ExerciseService } from '../exercise';
import {
  ButtonComponent,
  ChipRemovableListComponent,
  FormFieldComponent,
  FormGridComponent,
  FormInlineComponent,
  InputComponent,
  PageContainerComponent,
  PageStickyFooterComponent,
  PanelCardComponent,
  SelectComponent
} from '../../../shared/ui';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    PageContainerComponent,
    PageStickyFooterComponent,
    FormGridComponent,
    FormInlineComponent,
    PanelCardComponent,
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    ButtonComponent,
    ChipRemovableListComponent,
    ExercisePreviewCardComponent
  ],
  templateUrl: './exercise-form.html',
  styleUrls: ['./exercise-form.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseFormComponent implements OnInit {
  /** Lets PrimeNG render the success toast before a full navigation / reload. */
  private static readonly SUCCESS_TOAST_THEN_NAV_MS = 900;

  /** Aligned with API / `ANGULAR_IMPLEMENTATION.md` limits (used in template + handlers). */
  readonly maxInstructionSteps = 100;
  readonly maxMediaRows = 50;
  readonly maxCatalogTags = 50;
  readonly maxCatalogWarnings = 50;

  private static readonly FORM_SECTION_IDS: readonly string[] = [
    'basics',
    'classification',
    'target-muscles',
    'performance',
    'instructions',
    'warnings',
    'training-media',
    'tags'
  ];

  /** Collapsible form cards: all expanded by default. */
  readonly expandedSections = signal(
    new Set<string>([...ExerciseFormComponent.FORM_SECTION_IDS])
  );

  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fb = inject(FormBuilder);
  private readonly injector = inject(Injector);

  private readonly exerciseFormEl = viewChild<ElementRef<HTMLFormElement>>('exerciseForm');

  readonly form: FormGroup = this.fb.group({
    name: new SignalFormControl('', (p) => {
      required(p);
      minLength(p, 2);
      maxLength(p, 200);
    }),
    description: new SignalFormControl('', (p) => {
      required(p);
      maxLength(p, 1000);
    }),
    type: new SignalFormControl('', (p) => {
      required(p);
    }),
    movementType: new SignalFormControl('', (p) => {
      required(p);
    }),
    difficulty: new SignalFormControl('', (p) => {
      required(p);
    }),
    equipment: new SignalFormControl('', (p) => {
      required(p);
    }),
    muscleGroup: new SignalFormControl('', (p) => {
      required(p);
    }),
    secondaryMusclePicker: new SignalFormControl(''),
    imageUrl: new SignalFormControl(''),
    estimatedCaloriesBurn: new SignalFormControl(''),
    averageDurationSeconds: new SignalFormControl(''),
    tagPicker: new SignalFormControl('', (p) => {
      maxLength(p, 50);
    }),
    warningPicker: new SignalFormControl('', (p) => {
      maxLength(p, 500);
    }),
    instructionSteps: this.fb.array<FormControl<string>>([]),
    mediaRows: this.fb.array<FormGroup>([])
  });

  /** Additional `MuscleGroup` entries (API: `muscles` with `isPrimary: false`). */
  readonly secondaryMuscles = signal<MuscleGroup[]>([]);

  readonly previewData = signal<ExercisePreviewVm>(this.emptyPreview());

  /** Validated http(s) URL for inline image preview in the Media section. */
  readonly previewImageUrl = computed(() => {
    const url = this.previewData().imageUrl.trim();
    return url.startsWith('https://') || url.startsWith('http://') ? url : null;
  });

  /** True when the form or secondary muscles differ from the last loaded / initial snapshot. */
  readonly hasUnsavedChanges = signal(false);

  /** JSON snapshot of sorted secondary muscles when the form was last marked pristine. */
  private readonly initialSecondarySnapshot = signal<string>('[]');

  /** Editable catalog fields (also sent on create). */
  readonly catalogTags = signal<string[]>([]);
  readonly catalogWarnings = signal<string[]>([]);

  /** Inline error for tag picker (e.g. duplicate); cleared when the picker value changes. */
  readonly tagPickerContextError = signal<string | null>(null);

  private readonly initialInstructionsSnapshot = signal<string>('[]');
  private readonly initialCatalogTagsSnapshot = signal<string>('[]');
  private readonly initialCatalogWarningsSnapshot = signal<string>('[]');
  private readonly initialMediaRowsSnapshot = signal<string>('[]');

  isEditMode = false;
  exerciseId: string | null = null;

  readonly muscleGroups = this.exerciseService.muscleGroups;
  readonly equipmentList = this.exerciseService.equipmentList;
  readonly difficulties = this.exerciseService.difficulties;
  readonly exerciseTypes = this.exerciseService.exerciseTypes;
  readonly movementTypes = this.exerciseService.movementTypes;

  readonly mediaTypeOptions: readonly string[] = [...EXERCISE_MEDIA_TYPES];

  get instructionStepsArray(): FormArray<FormControl<string>> {
    return this.form.get('instructionSteps') as FormArray<FormControl<string>>;
  }

  get mediaRowsArray(): FormArray<FormGroup> {
    return this.form.get('mediaRows') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.form
      .get('muscleGroup')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((primary) => {
        this.secondaryMuscles.update((list) => list.filter((m) => m !== primary));
        this.cdr.markForCheck();
      });

    this.form
      .get('tagPicker')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.tagPickerContextError() !== null) {
          this.tagPickerContextError.set(null);
          this.cdr.markForCheck();
        }
      });

    merge(
      this.form.valueChanges.pipe(startWith(null)),
      this.form.statusChanges.pipe(startWith(null)),
      this.instructionStepsArray.valueChanges.pipe(startWith(null)),
      this.mediaRowsArray.valueChanges.pipe(startWith(null)),
      toObservable(this.secondaryMuscles, { injector: this.injector }),
      toObservable(this.catalogTags, { injector: this.injector }),
      toObservable(this.catalogWarnings, { injector: this.injector })
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.rebuildPreviewState();
        this.refreshUnsavedState();
        this.cdr.markForCheck();
      });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.isEditMode = false;
      this.initialSecondarySnapshot.set('[]');
      this.resetCatalogFormsToEmpty();
      this.form.markAsPristine();
      this.captureCatalogSnapshots();
      return;
    }

    this.isEditMode = true;
    this.exerciseId = idParam;

    this.exerciseService.getById(idParam).subscribe({
      next: (exercise) => {
        const primaryMuscle =
          exercise.muscles.find((m) => m.isPrimary)?.muscle ?? exercise.muscleGroup;

        const secondaries = exercise.muscles
          .filter((m) => !m.isPrimary)
          .map((m) => m.muscle as MuscleGroup);

        this.secondaryMuscles.set(secondaries);
        this.initialSecondarySnapshot.set(JSON.stringify([...secondaries].sort()));

        this.catalogTags.set([...(exercise.tags ?? [])]);
        this.catalogWarnings.set([...(exercise.warnings ?? [])]);

        this.instructionStepsArray.clear();
        const instructionLines =
          exercise.instructions?.filter((s) => String(s ?? '').trim().length) ?? [];
        if (instructionLines.length === 0) {
          this.instructionStepsArray.push(this.newInstructionControl(''));
        } else {
          for (const line of instructionLines) {
            this.instructionStepsArray.push(this.newInstructionControl(String(line)));
          }
        }

        this.mediaRowsArray.clear();
        const mediaItems = exercise.media?.filter((m) => String(m?.url ?? '').trim()) ?? [];
        if (mediaItems.length === 0) {
          this.mediaRowsArray.push(this.newMediaRowGroup());
        } else {
          for (const m of mediaItems) {
            const type = m.type?.toLowerCase() === 'video' ? 'Video' : 'Image';
            this.mediaRowsArray.push(
              this.fb.group({
                url: this.fb.nonNullable.control(String(m.url ?? ''), [Validators.maxLength(500)]),
                type: this.fb.nonNullable.control(type)
              })
            );
          }
        }

        this.form.patchValue({
          name: exercise.name,
          description: exercise.description,
          type: exercise.type,
          movementType: exercise.movementType,
          difficulty: exercise.difficulty,
          equipment: exercise.equipment,
          muscleGroup: primaryMuscle,
          imageUrl: normalizeNullableString(exercise.imageUrl),
          estimatedCaloriesBurn:
            exercise.estimatedCaloriesBurn != null ? String(exercise.estimatedCaloriesBurn) : '',
          averageDurationSeconds:
            exercise.averageDurationSeconds != null ? String(exercise.averageDurationSeconds) : '',
          tagPicker: '',
          warningPicker: ''
        });
        const imageCtrl = this.form.get('imageUrl');
        if (imageCtrl) {
          imageCtrl.setValue(normalizeNullableString(String(imageCtrl.value ?? '')), {
            emitEvent: false
          });
        }
        this.form.markAsPristine();
        this.captureCatalogSnapshots();
        this.rebuildPreviewState();
        this.refreshUnsavedState();
        this.cdr.markForCheck();
      },
      error: () => {
        this.messageService.add({
          severity: 'error',
          summary: 'Not found',
          detail: 'Exercise not found'
        });
        void this.router.navigate(['/exercises']);
      }
    });
  }

  saveButtonLabel(): string {
    return this.isEditMode ? 'Update Exercise' : 'Save Exercise';
  }

  requestFormSubmit(): void {
    this.exerciseFormEl()?.nativeElement?.requestSubmit();
  }

  toggleSection(id: string): void {
    this.expandedSections.update((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.messageService.add({
        severity: 'warn',
        summary: 'Check fields',
        detail: 'Fix validation errors before saving.'
      });
      return;
    }

    const burn = this.parseOptionalNonNegativeInt(this.form.value.estimatedCaloriesBurn ?? '');
    const duration = this.parseOptionalNonNegativeInt(this.form.value.averageDurationSeconds ?? '');
    if (this.form.value.estimatedCaloriesBurn?.trim() && burn === null) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid value',
        detail: 'Estimated calories must be a whole number ≥ 0 or empty'
      });
      return;
    }
    if (this.form.value.averageDurationSeconds?.trim() && duration === null) {
      this.messageService.add({
        severity: 'error',
        summary: 'Invalid value',
        detail: 'Average duration (seconds) must be a whole number ≥ 0 or empty'
      });
      return;
    }

    const v = this.form.getRawValue();
    const primaryMuscle = String(v.muscleGroup ?? '').trim();
    const secondary = this.secondaryMuscles();
    const muscles = [
      { muscle: primaryMuscle, isPrimary: true },
      ...secondary.map((m) => ({ muscle: m, isPrimary: false as const }))
    ];
    const instructions = (this.instructionStepsArray.getRawValue() as string[])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const media = this.mediaRowsArray.controls
      .map((g) => ({
        url: String(g.get('url')?.value ?? '').trim(),
        type: String(g.get('type')?.value ?? 'Image').trim() || 'Image'
      }))
      .filter((m) => m.url.length > 0);

    const payload: SaveExerciseRequest = {
      name: String(v.name ?? '').trim(),
      description: String(v.description ?? '').trim(),
      type: v.type!,
      movementType: v.movementType!,
      difficulty: v.difficulty!,
      equipment: v.equipment!,
      muscleGroup: primaryMuscle,
      muscles,
      imageUrl: v.imageUrl?.trim() ? v.imageUrl.trim() : null,
      estimatedCaloriesBurn: burn,
      averageDurationSeconds: duration,
      instructions,
      tags: [...this.catalogTags()],
      warnings: [...this.catalogWarnings()],
      media
    };

    if (this.isEditMode && this.exerciseId) {
      this.exerciseService.update(this.exerciseId, payload).subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: `"${payload.name}" updated`
          });
          this.exerciseService.load();
          globalThis.setTimeout(() => {
            globalThis.location.reload();
          }, ExerciseFormComponent.SUCCESS_TOAST_THEN_NAV_MS);
        },
        error: (err) => this.showHttpError(err)
      });
    } else {
      this.exerciseService.create(payload).subscribe({
        next: (newId) => {
          this.messageService.add({
            severity: 'success',
            summary: 'Saved',
            detail: `"${payload.name}" created`
          });
          this.exerciseService.load();
          const editUrl = this.router.serializeUrl(
            this.router.createUrlTree(['/exercises', 'edit', newId])
          );
          globalThis.setTimeout(() => {
            globalThis.location.assign(editUrl);
          }, ExerciseFormComponent.SUCCESS_TOAST_THEN_NAV_MS);
        },
        error: (err) => this.showHttpError(err)
      });
    }
  }

  onCancel(): void {
    void this.router.navigate(['/exercises']);
  }

  fieldError(field: string): string | null {
    const control = this.form.get(field);
    if (!control?.touched || !control.errors) {
      return null;
    }
    const e = control.errors;
    if (e['required']) {
      if (field === 'name') return 'Name is required';
      if (field === 'description') return 'Description is required';
      if (field === 'type') return 'Type is required';
      if (field === 'movementType') return 'Movement type is required';
      if (field === 'muscleGroup') return 'Primary muscle is required';
      if (field === 'equipment') return 'Equipment is required';
      if (field === 'difficulty') return 'Difficulty is required';
    }
    if (field === 'name') {
      if (e['minlength'] || e['minLength']) return 'Name must be at least 2 characters';
      if (this.hasMaxLengthError(e)) return 'Name must not exceed 200 characters';
    }
    if (field === 'description') {
      if (this.hasMaxLengthError(e)) return 'Description must not exceed 1000 characters';
    }
    if (field === 'tagPicker' && this.hasMaxLengthError(e)) {
      return 'Tag must be at most 50 characters';
    }
    if (field === 'warningPicker' && this.hasMaxLengthError(e)) {
      return 'Warning must be at most 500 characters';
    }
    return null;
  }

  instructionFieldError(index: number): string | null {
    const ctrl = this.instructionStepsArray.at(index);
    if (!ctrl?.touched || !ctrl.errors) {
      return null;
    }
    if (this.hasMaxLengthError(ctrl.errors)) {
      return 'Step must not exceed 1000 characters';
    }
    return null;
  }

  mediaUrlFieldError(index: number): string | null {
    const g = this.mediaRowsArray.at(index);
    const urlCtrl = g?.get('url');
    if (!urlCtrl?.touched || !urlCtrl.errors) {
      return null;
    }
    if (this.hasMaxLengthError(urlCtrl.errors)) {
      return 'URL must not exceed 500 characters';
    }
    return null;
  }

  private hasMaxLengthError(e: ValidationErrors): boolean {
    return !!(e['maxlength'] ?? e['maxLength']);
  }

  tagPickerErrorMessage(): string | null {
    return this.tagPickerContextError() ?? this.fieldError('tagPicker');
  }

  secondaryMusclePickerOptions(): readonly string[] {
    const primary = this.form.getRawValue().muscleGroup as string | undefined;
    const taken = new Set<MuscleGroup>(this.secondaryMuscles());
    return this.muscleGroups.filter((m) => m !== primary && !taken.has(m));
  }

  addSecondaryMuscle(): void {
    const pick = String(this.form.getRawValue().secondaryMusclePicker ?? '').trim() as MuscleGroup;
    const primary = String(this.form.getRawValue().muscleGroup ?? '').trim();
    if (!pick || pick === primary) {
      return;
    }
    if (this.secondaryMuscles().includes(pick)) {
      return;
    }
    this.secondaryMuscles.update((list) => [...list, pick]);
    this.form.patchValue({ secondaryMusclePicker: '' });
    this.cdr.markForCheck();
  }

  removeSecondaryMuscle(m: string): void {
    this.secondaryMuscles.update((list) => list.filter((x) => x !== m));
    this.cdr.markForCheck();
  }

  addInstructionStep(): void {
    if (this.instructionStepsArray.length >= this.maxInstructionSteps) {
      return;
    }
    this.instructionStepsArray.push(this.newInstructionControl(''));
    this.cdr.markForCheck();
  }

  removeInstructionStep(index: number): void {
    const arr = this.instructionStepsArray;
    if (arr.length > 1) {
      arr.removeAt(index);
    } else {
      arr.at(0)?.setValue('');
    }
    this.cdr.markForCheck();
  }

  addMediaRow(): void {
    if (this.mediaRowsArray.length >= this.maxMediaRows) {
      return;
    }
    this.mediaRowsArray.push(this.newMediaRowGroup());
    this.cdr.markForCheck();
  }

  removeMediaRow(index: number): void {
    const arr = this.mediaRowsArray;
    if (arr.length > 1) {
      arr.removeAt(index);
    } else {
      arr.at(0)?.patchValue({ url: '', type: 'Image' });
    }
    this.cdr.markForCheck();
  }

  onTagPickerEnter(ev: Event): void {
    ev.preventDefault();
    this.addCatalogTag();
  }

  instructionCharCount(ctrl: FormControl<string> | null): number {
    return String(ctrl?.value ?? '').length;
  }

  tagPickerCharCount(): number {
    return String(this.form.get('tagPicker')?.value ?? '').length;
  }

  warningPickerCharCount(): number {
    return String(this.form.get('warningPicker')?.value ?? '').length;
  }

  addCatalogTag(): void {
    const tagPicker = this.form.get('tagPicker');
    const raw = String(this.form.getRawValue()['tagPicker'] ?? '').trim();
    if (!raw) {
      return;
    }
    tagPicker?.markAsTouched();
    if (raw.length > 50) {
      tagPicker?.updateValueAndValidity();
      this.cdr.markForCheck();
      return;
    }
    const lower = raw.toLowerCase();
    if (this.catalogTags().some((t) => t.toLowerCase() === lower)) {
      this.tagPickerContextError.set('This tag is already in the list');
      this.cdr.markForCheck();
      return;
    }
    if (this.catalogTags().length >= this.maxCatalogTags) {
      this.tagPickerContextError.set(`You can add at most ${this.maxCatalogTags} tags`);
      this.cdr.markForCheck();
      return;
    }
    this.tagPickerContextError.set(null);
    this.catalogTags.update((t) => [...t, raw]);
    this.form.patchValue({ tagPicker: '' });
    tagPicker?.markAsUntouched();
    this.cdr.markForCheck();
  }

  removeCatalogTag(tag: string): void {
    this.catalogTags.update((t) => t.filter((x) => x !== tag));
    this.cdr.markForCheck();
  }

  addCatalogWarning(): void {
    const warningPicker = this.form.get('warningPicker');
    const raw = String(this.form.getRawValue()['warningPicker'] ?? '').trim();
    if (!raw) {
      return;
    }
    warningPicker?.markAsTouched();
    if (raw.length > 500) {
      warningPicker?.updateValueAndValidity();
      this.cdr.markForCheck();
      return;
    }
    if (this.catalogWarnings().length >= this.maxCatalogWarnings) {
      warningPicker?.markAsTouched();
      this.cdr.markForCheck();
      return;
    }
    this.catalogWarnings.update((w) => [...w, raw]);
    this.form.patchValue({ warningPicker: '' });
    warningPicker?.markAsUntouched();
    this.cdr.markForCheck();
  }

  removeCatalogWarning(line: string): void {
    this.catalogWarnings.update((w) => w.filter((x) => x !== line));
    this.cdr.markForCheck();
  }

  private newInstructionControl(value = ''): FormControl<string> {
    return this.fb.nonNullable.control(value, [Validators.maxLength(1000)]);
  }

  private newMediaRowGroup(): FormGroup {
    return this.fb.group({
      url: this.fb.nonNullable.control('', [Validators.maxLength(500)]),
      type: this.fb.nonNullable.control('Image')
    });
  }

  private resetCatalogFormsToEmpty(): void {
    this.instructionStepsArray.clear();
    this.instructionStepsArray.push(this.newInstructionControl(''));
    this.mediaRowsArray.clear();
    this.mediaRowsArray.push(this.newMediaRowGroup());
    this.catalogTags.set([]);
    this.catalogWarnings.set([]);
    this.tagPickerContextError.set(null);
    this.form.patchValue({ tagPicker: '', warningPicker: '' });
  }

  private captureCatalogSnapshots(): void {
    this.initialInstructionsSnapshot.set(JSON.stringify(this.instructionStepsArray.getRawValue()));
    this.initialCatalogTagsSnapshot.set(JSON.stringify([...this.catalogTags()].sort()));
    this.initialCatalogWarningsSnapshot.set(JSON.stringify([...this.catalogWarnings()].sort()));
    this.initialMediaRowsSnapshot.set(JSON.stringify(this.mediaRowsArray.getRawValue()));
  }

  private rebuildPreviewState(): void {
    const v = this.form.getRawValue();
    this.previewData.set(this.buildPreviewVm(v));
  }

  private refreshUnsavedState(): void {
    const sorted = [...this.secondaryMuscles()].sort();
    const secondariesDirty = JSON.stringify(sorted) !== this.initialSecondarySnapshot();
    const instructionsDirty =
      JSON.stringify(this.instructionStepsArray.getRawValue()) !== this.initialInstructionsSnapshot();
    const mediaDirty =
      JSON.stringify(this.mediaRowsArray.getRawValue()) !== this.initialMediaRowsSnapshot();
    const tagsDirty =
      JSON.stringify([...this.catalogTags()].sort()) !== this.initialCatalogTagsSnapshot();
    const warningsDirty =
      JSON.stringify([...this.catalogWarnings()].sort()) !== this.initialCatalogWarningsSnapshot();
    this.hasUnsavedChanges.set(
      this.form.dirty ||
        secondariesDirty ||
        instructionsDirty ||
        mediaDirty ||
        tagsDirty ||
        warningsDirty
    );
  }

  private buildPreviewVm(v: Record<string, unknown>): ExercisePreviewVm {
    const name = String(v['name'] ?? '').trim() || 'Exercise name';
    const calRaw = String(v['estimatedCaloriesBurn'] ?? '').trim();
    const durRaw = String(v['averageDurationSeconds'] ?? '').trim();
    const instructions = (this.instructionStepsArray.getRawValue() as string[])
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const mediaRaw = this.mediaRowsArray.getRawValue() as { url: string; type: string }[];
    const catalogMedia = mediaRaw
      .map((m) => ({
        url: String(m.url ?? '').trim(),
        type: String(m.type ?? 'Image').trim() || 'Image'
      }))
      .filter((m) => m.url.length > 0);
    return {
      name,
      description: String(v['description'] ?? '').trim(),
      imageUrl: String(v['imageUrl'] ?? '').trim(),
      type: String(v['type'] ?? '').trim(),
      movementType: String(v['movementType'] ?? '').trim(),
      difficulty: String(v['difficulty'] ?? '').trim(),
      equipment: String(v['equipment'] ?? '').trim(),
      primaryMuscle: String(v['muscleGroup'] ?? '').trim(),
      secondaryMuscles: this.secondaryMuscles(),
      caloriesLabel: calRaw ? `~${calRaw} cal` : '',
      durationLabel: durRaw ? `~${durRaw}s` : '',
      instructions,
      catalogTags: [...this.catalogTags()],
      catalogWarnings: [...this.catalogWarnings()],
      catalogMedia
    };
  }

  private emptyPreview(): ExercisePreviewVm {
    return {
      name: 'Exercise name',
      description: '',
      imageUrl: '',
      type: '',
      movementType: '',
      difficulty: '',
      equipment: '',
      primaryMuscle: '',
      secondaryMuscles: [],
      caloriesLabel: '',
      durationLabel: '',
      instructions: [],
      catalogTags: [],
      catalogWarnings: [],
      catalogMedia: []
    };
  }

  private parseOptionalNonNegativeInt(raw: string): number | null {
    const s = raw.trim();
    if (!s) {
      return null;
    }
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0) {
      return null;
    }
    return n;
  }

  private showHttpError(err: { error?: unknown; message?: string }): void {
    const detail =
      typeof err.error === 'string' && err.error.trim()
        ? err.error
        : err.message || 'Request failed';
    this.messageService.add({ severity: 'error', summary: 'Error', detail });
  }
}

/** Treat JSON/string garbage as empty (matches nullable API fields shown as "null"). */
function normalizeNullableString(v: string | null | undefined): string {
  if (v == null) {
    return '';
  }
  const t = v.trim();
  if (!t || t.toLowerCase() === 'null' || t.toLowerCase() === 'undefined') {
    return '';
  }
  return t;
}
