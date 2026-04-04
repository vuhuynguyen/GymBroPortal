import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Exercise, MuscleGroup, Equipment, Difficulty } from '../exercise.model';
import { ExerciseService } from '../exercise.service';

@Component({
  selector: 'app-exercise-list',
  templateUrl: './exercise-list.component.html',
  styleUrls: ['./exercise-list.component.scss']
})
export class ExerciseListComponent implements OnInit, OnDestroy {
  displayedColumns: string[] = ['name', 'muscle', 'equipment', 'difficulty', 'actions'];
  dataSource = new MatTableDataSource<Exercise>([]);

  searchValue = '';
  selectedMuscle: MuscleGroup | '' = '';
  selectedEquipment: Equipment | '' = '';
  selectedDifficulty: Difficulty | '' = '';

  muscleGroups: MuscleGroup[];
  equipmentList: Equipment[];
  difficulties: Difficulty[];

  private destroy$ = new Subject<void>();

  constructor(
    private exerciseService: ExerciseService,
    private router: Router,
    private snackBar: MatSnackBar
  ) {
    this.muscleGroups = this.exerciseService.muscleGroups;
    this.equipmentList = this.exerciseService.equipmentList;
    this.difficulties = this.exerciseService.difficulties;
  }

  ngOnInit(): void {
    this.exerciseService.exercises$
      .pipe(takeUntil(this.destroy$))
      .subscribe(exercises => {
        this.dataSource.data = exercises;
        this.applyFilters();
      });

    this.dataSource.filterPredicate = this.createFilterPredicate();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createFilterPredicate() {
    return (data: Exercise, filter: string): boolean => {
      const f = JSON.parse(filter);
      const matchSearch = !f.search ||
        data.name.toLowerCase().includes(f.search) ||
        data.description.toLowerCase().includes(f.search);
      const matchMuscle = !f.muscle || data.muscle === f.muscle;
      const matchEquipment = !f.equipment || data.equipment === f.equipment;
      const matchDifficulty = !f.difficulty || data.difficulty === f.difficulty;
      return matchSearch && matchMuscle && matchEquipment && matchDifficulty;
    };
  }

  applyFilters(): void {
    this.dataSource.filter = JSON.stringify({
      search: this.searchValue.toLowerCase().trim(),
      muscle: this.selectedMuscle,
      equipment: this.selectedEquipment,
      difficulty: this.selectedDifficulty
    });
  }

  clearFilters(): void {
    this.searchValue = '';
    this.selectedMuscle = '';
    this.selectedEquipment = '';
    this.selectedDifficulty = '';
    this.applyFilters();
  }

  createExercise(): void {
    this.router.navigate(['/exercises/create']);
  }

  editExercise(exercise: Exercise): void {
    this.router.navigate(['/exercises/edit', exercise.id]);
  }

  deleteExercise(exercise: Exercise): void {
    if (confirm(`Delete exercise "${exercise.name}"?`)) {
      this.exerciseService.delete(exercise.id);
      this.snackBar.open(`"${exercise.name}" deleted`, 'Dismiss', { duration: 3000 });
    }
  }

  getDifficultyClass(difficulty: Difficulty): string {
    const map: Record<Difficulty, string> = {
      Beginner: 'chip-beginner',
      Intermediate: 'chip-intermediate',
      Advanced: 'chip-advanced'
    };
    return map[difficulty];
  }
}
