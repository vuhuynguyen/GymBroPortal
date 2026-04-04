import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Exercise, MuscleGroup, Equipment, Difficulty } from '../exercise.model';
import { ExerciseService } from '../exercise.service';

@Component({
  selector: 'app-exercise-form',
  templateUrl: './exercise-form.component.html',
  styleUrls: ['./exercise-form.component.scss']
})
export class ExerciseFormComponent implements OnInit {
  form: FormGroup;
  isEditMode = false;
  exerciseId: number | null = null;
  pageTitle = 'Create Exercise';

  muscleGroups: MuscleGroup[];
  equipmentList: Equipment[];
  difficulties: Difficulty[];

  constructor(
    private fb: FormBuilder,
    private exerciseService: ExerciseService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.muscleGroups = this.exerciseService.muscleGroups;
    this.equipmentList = this.exerciseService.equipmentList;
    this.difficulties = this.exerciseService.difficulties;

    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]],
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
        this.snackBar.open('Exercise not found', 'Dismiss', { duration: 3000 });
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
      this.snackBar.open(`"${value.name}" updated successfully`, 'Dismiss', { duration: 3000 });
    } else {
      this.exerciseService.create(value);
      this.snackBar.open(`"${value.name}" created successfully`, 'Dismiss', { duration: 3000 });
    }

    this.router.navigate(['/exercises']);
  }

  onCancel(): void {
    this.router.navigate(['/exercises']);
  }

  getError(field: string, error: string): boolean {
    const control = this.form.get(field);
    return !!(control && control.touched && control.hasError(error));
  }
}
