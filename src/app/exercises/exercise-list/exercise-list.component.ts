import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ButtonComponent,
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
    ButtonComponent
  ],
  templateUrl: './exercise-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExerciseListComponent implements OnInit {
  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);

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
}
