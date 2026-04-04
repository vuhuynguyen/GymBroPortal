import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Exercise, Difficulty, Equipment, MuscleGroup } from './exercise.model';

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private nextId = 6;
  private exercises: Exercise[] = [
    {
      id: 1,
      name: 'Bench Press',
      description: 'Classic chest compound movement using a barbell on a flat bench.',
      muscle: 'Chest',
      equipment: 'Barbell',
      difficulty: 'Intermediate'
    },
    {
      id: 2,
      name: 'Pull-Up',
      description: 'Upper body exercise targeting the back and biceps using bodyweight.',
      muscle: 'Back',
      equipment: 'Bodyweight',
      difficulty: 'Intermediate'
    },
    {
      id: 3,
      name: 'Squat',
      description: 'Fundamental lower body compound movement with a barbell.',
      muscle: 'Legs',
      equipment: 'Barbell',
      difficulty: 'Intermediate'
    },
    {
      id: 4,
      name: 'Plank',
      description: 'Core stability exercise performed in a push-up position.',
      muscle: 'Core',
      equipment: 'Bodyweight',
      difficulty: 'Beginner'
    },
    {
      id: 5,
      name: 'Overhead Press',
      description: 'Shoulder pressing movement performed standing with a barbell.',
      muscle: 'Shoulders',
      equipment: 'Barbell',
      difficulty: 'Intermediate'
    }
  ];

  private exercisesSubject = new BehaviorSubject<Exercise[]>(this.exercises);
  exercises$: Observable<Exercise[]> = this.exercisesSubject.asObservable();

  readonly muscleGroups: MuscleGroup[] = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body'];
  readonly equipmentList: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Resistance Band', 'Kettlebell'];
  readonly difficulties: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

  getAll(): Exercise[] {
    return this.exercises;
  }

  getById(id: number): Exercise | undefined {
    return this.exercises.find(e => e.id === id);
  }

  create(exercise: Omit<Exercise, 'id'>): Exercise {
    const newExercise: Exercise = { ...exercise, id: this.nextId++ };
    this.exercises = [...this.exercises, newExercise];
    this.exercisesSubject.next(this.exercises);
    return newExercise;
  }

  update(id: number, exercise: Omit<Exercise, 'id'>): Exercise | null {
    const index = this.exercises.findIndex(e => e.id === id);
    if (index === -1) return null;
    const updated: Exercise = { ...exercise, id };
    this.exercises = [
      ...this.exercises.slice(0, index),
      updated,
      ...this.exercises.slice(index + 1)
    ];
    this.exercisesSubject.next(this.exercises);
    return updated;
  }

  delete(id: number): boolean {
    const index = this.exercises.findIndex(e => e.id === id);
    if (index === -1) return false;
    this.exercises = this.exercises.filter(e => e.id !== id);
    this.exercisesSubject.next(this.exercises);
    return true;
  }
}
