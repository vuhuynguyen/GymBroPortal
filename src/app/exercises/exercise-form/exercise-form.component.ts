import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { CardModule } from 'primeng/card';
import { TextareaModule } from 'primeng/textarea';
import { Exercise, MuscleGroup, Equipment, Difficulty } from '../exercise.model';
import { ExerciseService } from '../exercise.service';
import {
  ButtonComponent,
  FormFieldComponent,
  InputComponent,
  PageHeaderComponent,
  SelectComponent
} from '../../shared/ui';

@Component({
  selector: 'app-exercise-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardModule,
    TextareaModule,
    PageHeaderComponent,
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    ButtonComponent
  ],
  templateUrl: './exercise-form.component.html',
  styleUrls: ['./exercise-form.component.scss']
})
export class ExerciseFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly exerciseService = inject(ExerciseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly messageService = inject(MessageService);

  form: FormGroup;
  isEditMode = false;
  exerciseId: number | null = null;
  pageTitle = 'Create Exercise';

  readonly muscleGroups: MuscleGroup[];
  readonly equipmentList: Equipment[];
  readonly difficulties: Difficulty[];

  constructor() {
    this.muscleGroups = this.exerciseService.muscleGroups;
    this.equipmentList = this.exerciseService.equipmentList;
    this.difficulties = this.exerciseService.difficulties;

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      description: [
        '',
        [Validators.required, Validators.minLength(10), Validators.maxLength(500)]
      ],
      muscle: ['', Validators.required],
      equipment: ['', Validators.required],
      difficulty: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.isEditMode = true;
      this.exerciseId = parseInt(idParam, 10);
      this.pageTitle = 'Edit Exercise';

      const exercise = this.exerciseService.getById(this.exerciseId);
      if (exercise) {
        this.form.patchValue({
          name: exercise.name,
          description: exercise.description,
          muscle: exercise.muscle,
          equipment: exercise.equipment,
          difficulty: exercise.difficulty
        });
      } else {
        this.messageService.add({
          severity: 'error',
          summary: 'Not found',
          detail: 'Exercise not found'
        });
        this.router.navigate(['/exercises']);
      }
    }
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.value as Omit<Exercise, 'id'>;

    if (this.isEditMode && this.exerciseId !== null) {
      this.exerciseService.update(this.exerciseId, value);
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: `"${value.name}" updated`
      });
    } else {
      this.exerciseService.create(value);
      this.messageService.add({
        severity: 'success',
        summary: 'Saved',
        detail: `"${value.name}" created`
      });
    }

    this.router.navigate(['/exercises']);
  }

  onCancel(): void {
    this.router.navigate(['/exercises']);
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
      if (field === 'muscle') return 'Muscle group is required';
      if (field === 'equipment') return 'Equipment is required';
      if (field === 'difficulty') return 'Difficulty is required';
    }
    if (field === 'name') {
      if (e['minlength']) return 'Name must be at least 2 characters';
      if (e['maxlength']) return 'Name must not exceed 100 characters';
    }
    if (field === 'description') {
      if (e['minlength']) return 'Description must be at least 10 characters';
      if (e['maxlength']) return 'Description must not exceed 500 characters';
    }
    return null;
  }
}
