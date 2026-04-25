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
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { startWith } from 'rxjs';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonComponent, InputComponent } from '../../../../shared/ui';
import type { ExerciseDto } from '../../../exercises/exercise.model';
import { MUSCLE_GROUPS } from '../../../exercises/exercise.model';

export interface ExercisePickerAddPayload {
  exerciseId: string;
  sets: number;
  reps: number;
  restSeconds: number;
  addAnother: boolean;
}

/** Muscle-group tabs shown above the search list; "All" is the default. */
const ALL_MUSCLES = 'All' as const;
type MuscleTab = typeof ALL_MUSCLES | (typeof MUSCLE_GROUPS)[number];

/**
 * Side-panel catalog picker used by the workout plan builder.
 *
 * Acts as a lightweight tool, not a blocking modal: the user picks an exercise,
 * tunes sets/reps/rest, then confirms. With "Add another" checked the panel
 * stays open so coaches can batch-add exercises quickly.
 */
@Component({
  selector: 'app-exercise-picker-panel',
  standalone: true,
  imports: [ReactiveFormsModule, IconField, InputIcon, InputTextModule, ButtonComponent, InputComponent],
  templateUrl: './exercise-picker-panel.html',
  styleUrl: './exercise-picker-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExercisePickerPanelComponent {
  private readonly fb = inject(NonNullableFormBuilder);

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

  readonly detailsForm = this.fb.group({
    sets: [3, [Validators.required, Validators.min(1), Validators.max(20)]],
    reps: [10, [Validators.required, Validators.min(1), Validators.max(99)]],
    restSeconds: [60, [Validators.required, Validators.min(0), Validators.max(600)]],
    addAnother: [true]
  });

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

  readonly canAdd = computed(() => !!this.selectedId() && this.detailsForm.valid);

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

  submit(): void {
    this.detailsForm.markAllAsTouched();
    if (!this.selectedId() || this.detailsForm.invalid) return;

    const v = this.detailsForm.getRawValue();
    this.added.emit({
      exerciseId: this.selectedId()!,
      sets: Number(v.sets),
      reps: Number(v.reps),
      restSeconds: Number(v.restSeconds),
      addAnother: !!v.addAnother
    });

    if (v.addAnother) {
      this.selectedId.set(null);
      this.searchControl.setValue('');
    }
  }
}
