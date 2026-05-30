import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { merge, startWith } from 'rxjs';
import { map } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { ButtonComponent } from '../../../../shared/ui';
import type { ExerciseDto } from '../../../exercises/exercise.model';
import { MUSCLE_GROUPS } from '../../../exercises/exercise.model';
import type { PlanSetTypeApi } from '../workout-plan.model';

/** A prescribed set as configured in the picker — consumer turns it into a PlanSetRequest. */
export interface ExercisePickerSetSeed {
  setType: PlanSetTypeApi;
  targetReps: number;
  targetWeightKg: number | null;
  targetRpe: number | null;
  restSeconds: number;
}

export interface ExercisePickerAddPayload {
  exerciseId: string;
  sets: ExercisePickerSetSeed[];
  addAnother: boolean;
}

/** Muscle-group tabs shown above the search list; "All" is the default. */
const ALL_MUSCLES = 'All' as const;
type MuscleTab = typeof ALL_MUSCLES | (typeof MUSCLE_GROUPS)[number];

@Component({
  selector: 'app-exercise-picker-panel',
  standalone: true,
  imports: [ReactiveFormsModule, IconField, InputIcon, InputTextModule, Tooltip, ButtonComponent],
  templateUrl: './exercise-picker-panel.html',
  styleUrl: './exercise-picker-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExercisePickerPanelComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly messageService = inject(MessageService);

  readonly exercises = input.required<ExerciseDto[]>();
  /** Optional context label shown in the header subtitle (e.g. the workout name). */
  readonly workoutLabel = input<string | null>(null);

  readonly closed = output<void>();
  readonly added = output<ExercisePickerAddPayload>();

  readonly muscleTabs: readonly MuscleTab[] = [ALL_MUSCLES, ...MUSCLE_GROUPS];
  readonly activeMuscle = signal<MuscleTab>(ALL_MUSCLES);
  readonly selectedId = signal<string | null>(null);

  readonly searchControl = new FormControl<string>('', { nonNullable: true });
  private readonly searchSignal = toSignal(
    this.searchControl.valueChanges.pipe(startWith(this.searchControl.value)),
    { initialValue: '' }
  );

  readonly setTypeOptions: ReadonlyArray<{ value: PlanSetTypeApi; label: string }> = [
    { value: 'warmup', label: 'Warmup' },
    { value: 'working', label: 'Working' },
    { value: 'drop', label: 'Drop' },
    { value: 'amrap', label: 'AMRAP' }
  ];

  readonly detailsForm = this.fb.group({
    sets: this.fb.array<FormGroup>([this.createSetGroup()]),
    addAnother: this.fb.control<boolean>(true)
  });

  /** Reactive forms validity is not a signal — track it explicitly for canAdd. */
  private readonly formValid = toSignal(
    merge(this.detailsForm.statusChanges, this.detailsForm.valueChanges).pipe(
      map(() => this.detailsForm.valid)
    ),
    { initialValue: this.detailsForm.valid }
  );

  get setsArray(): FormArray<FormGroup> {
    return this.detailsForm.get('sets') as FormArray<FormGroup>;
  }

  private createSetGroup(seed?: Partial<ExercisePickerSetSeed>): FormGroup {
    return this.fb.group({
      key: [crypto.randomUUID()],
      setType: [seed?.setType ?? ('working' as PlanSetTypeApi), Validators.required],
      targetReps: [seed?.targetReps ?? 10, [Validators.required, Validators.min(1), Validators.max(99)]],
      targetWeightKg: this.fb.control<number | null>(seed?.targetWeightKg ?? null, [Validators.min(0)]),
      targetRpe: this.fb.control<number | null>(seed?.targetRpe ?? null, [Validators.min(1), Validators.max(10)]),
      restSeconds: [seed?.restSeconds ?? 60, [Validators.required, Validators.min(0), Validators.max(600)]]
    });
  }

  setTrackKey = (_index: number, group: FormGroup): string => {
    const k = group.get('key')?.value;
    return typeof k === 'string' ? k : `set-${_index}`;
  };

  addSet(): void {
    if (this.setsArray.length >= 20) return;
    const last = this.setsArray.length > 0
      ? (this.setsArray.at(this.setsArray.length - 1).value as Record<string, unknown>)
      : null;
    this.setsArray.push(
      this.createSetGroup(
        last
          ? {
              setType: last['setType'] as PlanSetTypeApi,
              targetReps: last['targetReps'] as number,
              targetWeightKg: last['targetWeightKg'] as number | null,
              targetRpe: last['targetRpe'] as number | null,
              restSeconds: last['restSeconds'] as number
            }
          : {}
      )
    );
  }

  removeSet(index: number): void {
    if (this.setsArray.length <= 1) return;
    this.setsArray.removeAt(index);
  }

  /** Filtered catalog: muscle tab first, then free-text search across name / equipment / type. */
  readonly filtered = computed<ExerciseDto[]>(() => {
    const list = this.exercises();
    const muscle = this.activeMuscle();
    const q = this.searchSignal().trim().toLowerCase();

    return list.filter((e) => {
      if (muscle !== ALL_MUSCLES && e.muscleGroup !== muscle) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.muscleGroup.toLowerCase().includes(q) ||
        e.equipment.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
      );
    });
  });

  readonly canAdd = computed(() => !!this.selectedId() && this.formValid() === true);

  readonly selectedExercise = computed<ExerciseDto | null>(() => {
    const id = this.selectedId();
    if (!id) return null;
    return this.exercises().find((e) => e.id === id) ?? null;
  });

  close(): void {
    this.closed.emit();
  }

  setMuscle(tab: MuscleTab): void {
    this.activeMuscle.set(tab);
  }

  selectExercise(id: string): void {
    this.selectedId.set(id);
  }

  isSelected(id: string): boolean {
    return this.selectedId() === id;
  }

  private resetSetsToDefault(): void {
    while (this.setsArray.length > 0) this.setsArray.removeAt(0);
    this.setsArray.push(this.createSetGroup());
  }

  submit(): void {
    this.detailsForm.markAllAsTouched();
    if (!this.selectedId()) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Select an exercise',
        detail: 'Choose an exercise from the list above.'
      });
      return;
    }
    if (this.detailsForm.invalid) {
      this.messageService.add({
        severity: 'warn',
        summary: 'Fix set details',
        detail: 'Check reps, weight, RPE, and rest values before adding.'
      });
      return;
    }

    const v = this.detailsForm.getRawValue();
    const seeds: ExercisePickerSetSeed[] = (v.sets as Array<Record<string, unknown>>).map((row) => ({
      setType: row['setType'] as PlanSetTypeApi,
      targetReps: Number(row['targetReps']),
      targetWeightKg:
        row['targetWeightKg'] === '' || row['targetWeightKg'] == null
          ? null
          : Number(row['targetWeightKg']),
      targetRpe:
        row['targetRpe'] === '' || row['targetRpe'] == null ? null : Number(row['targetRpe']),
      restSeconds: Number(row['restSeconds'])
    }));

    this.added.emit({
      exerciseId: this.selectedId()!,
      sets: seeds,
      addAnother: !!v.addAnother
    });

    if (v.addAnother) {
      this.selectedId.set(null);
      this.searchControl.setValue('');
      this.resetSetsToDefault();
    }
  }
}
