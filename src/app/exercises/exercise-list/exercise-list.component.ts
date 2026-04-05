import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { map, startWith } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageHeaderComponent,
  type TableColumn,
  type TableTagSeverity
} from '../../shared/ui';
import { Exercise, Difficulty } from '../exercise.model';
import { ExerciseService } from '../exercise.service';

/**
 * Sample rows for tests, Storybook, or UI-only demos (same shape as API data).
 * Production data still flows from {@link ExerciseService}.
 */
export const EXERCISE_LIST_SAMPLE_ROWS: Exercise[] = [
  {
    id: 101,
    name: 'Sample Bench',
    description: 'Demo row for layout testing.',
    muscle: 'Chest',
    equipment: 'Barbell',
    difficulty: 'Intermediate'
  },
  {
    id: 102,
    name: 'Sample Plank',
    description: 'Another demo row.',
    muscle: 'Core',
    equipment: 'Bodyweight',
    difficulty: 'Beginner'
  }
];

@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [PageHeaderComponent, DataTableComponent, DataTableCellTemplateDirective, ButtonComponent],
  templateUrl: './exercise-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseListComponent {
  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    { field: 'description', header: 'Description', type: 'custom', includeInGlobalSearch: false, maxWidth: '360px' },
    {
      field: 'muscle',
      header: 'Muscle Group',
      filter: true,
      filterType: 'select',
      options: this.exerciseService.muscleGroups.map((m) => ({ label: m, value: m }))
    },
    {
      field: 'equipment',
      header: 'Equipment',
      filter: true,
      filterType: 'select',
      options: this.exerciseService.equipmentList.map((e) => ({ label: e, value: e }))
    },
    {
      field: 'difficulty',
      header: 'Difficulty',
      type: 'tag',
      filter: true,
      filterType: 'select',
      options: this.exerciseService.difficulties.map((d) => ({ label: d, value: d })),
      tagSeverityResolver: (value) => this.difficultySeverity(value as Difficulty)
    },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  protected readonly exercises = toSignal(this.exerciseService.exercises$, {
    initialValue: [] as Exercise[]
  });

  readonly loading = toSignal(
    this.exerciseService.exercises$.pipe(map(() => false), startWith(true)),
    { initialValue: true }
  );

  createExercise(): void {
    this.router.navigate(['/exercises/create']);
  }

  editExercise(exercise: Exercise): void {
    this.router.navigate(['/exercises/edit', exercise.id]);
  }

  deleteExercise(exercise: Exercise): void {
    if (confirm(`Delete exercise "${exercise.name}"?`)) {
      this.exerciseService.delete(exercise.id);
      this.messageService.add({
        severity: 'success',
        summary: 'Deleted',
        detail: `"${exercise.name}" removed`
      });
    }
  }

  difficultySeverity(difficulty: Difficulty): TableTagSeverity {
    const map: Record<Difficulty, TableTagSeverity> = {
      Beginner: 'success',
      Intermediate: 'info',
      Advanced: 'danger'
    };
    return map[difficulty];
  }

}
