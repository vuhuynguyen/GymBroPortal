import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  inject,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import {
  ButtonComponent,
  ConfirmSplitDialogComponent,
  DataTableCellTemplateDirective,
  DataTableComponent,
  PageContainerComponent,
  PageHeaderComponent,
  type TableColumn
} from '../../shared/ui';
import { exerciseDifficultyTagSeverity } from '../exercise-difficulty-tag-severity';
import { ExerciseDto } from '../exercise.model';
import { ExerciseService } from '../exercise.service';



@Component({
  selector: 'app-exercise-list',
  standalone: true,
  imports: [
    PageContainerComponent,
    PageHeaderComponent,
    DataTableComponent,
    DataTableCellTemplateDirective,
    ButtonComponent,
    ConfirmSplitDialogComponent
  ],
  templateUrl: './exercise-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseListComponent implements OnInit {
  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);
  private readonly messageService = inject(MessageService);

  /** Disables row action buttons while a delete request is in flight. */
  protected readonly deleteInProgress = signal(false);

  /** Exercise pending delete confirmation, or null when dialog is closed. */
  protected readonly deleteTarget = signal<ExerciseDto | null>(null);

  protected readonly deleteDialogMessage = computed(() => {
    const ex = this.deleteTarget();
    const name = ex?.name?.trim() || 'this exercise';
    return `This will permanently remove "${name}" from your catalog.`;
  });

  readonly tableColumns: TableColumn[] = [
    { field: 'name', header: 'Name', type: 'custom', filter: true, filterType: 'text' },
    {
      field: 'type',
      header: 'Type',
      filter: true,
      filterType: 'select',
      options: this.exerciseService.exerciseTypes.map((t) => ({ label: t, value: t }))
    },
    {
      field: 'movementType',
      header: 'Movement',
      filter: true,
      filterType: 'select',
      options: this.exerciseService.movementTypes.map((m) => ({ label: m, value: m }))
    },
    {
      field: 'muscleGroup',
      header: 'Primary muscle',
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
      tagSeverityResolver: (value) => exerciseDifficultyTagSeverity(String(value ?? ''))
    },
    { field: 'actions', header: '', type: 'custom', includeInGlobalSearch: false }
  ];

  protected readonly exercises = this.exerciseService.exercises;
  protected readonly loading = this.exerciseService.loading;

  ngOnInit(): void {
    this.exerciseService.load();
  }

  createExercise(): void {
    this.router.navigate(['/exercises/create']);
  }

  editExercise(exercise: ExerciseDto): void {
    this.router.navigate(['/exercises/edit', exercise.id]);
  }

  confirmDeleteExercise(exercise: ExerciseDto): void {
    this.deleteTarget.set(exercise);
  }

  onDeleteDialogOpenChange(open: boolean): void {
    if (!open) {
      this.deleteTarget.set(null);
    }
  }

  onDeleteConfirmed(): void {
    const ex = this.deleteTarget();
    if (!ex) {
      return;
    }
    this.performDeleteExercise(ex.id);
  }

  private performDeleteExercise(id: string): void {
    this.deleteInProgress.set(true);
    this.exerciseService.delete(id).subscribe({
      next: () => {
        this.deleteInProgress.set(false);
        this.messageService.add({
          severity: 'success',
          summary: 'Deleted',
          detail: 'Exercise removed from the catalog.'
        });
        this.exerciseService.load();
      },
      error: (err: { error?: unknown; message?: string }) => {
        this.deleteInProgress.set(false);
        const detail =
          typeof err.error === 'string' && err.error.trim()
            ? err.error
            : err.message || 'Request failed';
        this.messageService.add({ severity: 'error', summary: 'Error', detail });
      }
    });
  }
}
