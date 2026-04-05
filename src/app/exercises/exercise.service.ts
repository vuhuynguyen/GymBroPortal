import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Exercise, Difficulty, Equipment, MuscleGroup } from './exercise.model';

@Injectable({
  providedIn: 'root'
})
export class ExerciseService {
  private nextId = 26;
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
    },
    {
      id: 6,
      name: 'Deadlift',
      description: 'Full-body posterior chain compound lift with a barbell from the floor.',
      muscle: 'Back',
      equipment: 'Barbell',
      difficulty: 'Advanced'
    },
    {
      id: 7,
      name: 'Dumbbell Curl',
      description: 'Isolation exercise targeting the biceps with dumbbells.',
      muscle: 'Arms',
      equipment: 'Dumbbell',
      difficulty: 'Beginner'
    },
    {
      id: 8,
      name: 'Tricep Pushdown',
      description: 'Cable isolation exercise for the triceps using a rope or bar attachment.',
      muscle: 'Arms',
      equipment: 'Cable',
      difficulty: 'Beginner'
    },
    {
      id: 9,
      name: 'Leg Press',
      description: 'Machine-based lower body exercise targeting quads, hamstrings, and glutes.',
      muscle: 'Legs',
      equipment: 'Machine',
      difficulty: 'Beginner'
    },
    {
      id: 10,
      name: 'Incline Dumbbell Press',
      description: 'Upper chest focused pressing movement on an incline bench with dumbbells.',
      muscle: 'Chest',
      equipment: 'Dumbbell',
      difficulty: 'Intermediate'
    },
    {
      id: 11,
      name: 'Lat Pulldown',
      description: 'Cable machine exercise targeting the latissimus dorsi.',
      muscle: 'Back',
      equipment: 'Cable',
      difficulty: 'Beginner'
    },
    {
      id: 12,
      name: 'Romanian Deadlift',
      description: 'Hip-hinge movement emphasising the hamstrings and glutes with a barbell.',
      muscle: 'Legs',
      equipment: 'Barbell',
      difficulty: 'Intermediate'
    },
    {
      id: 13,
      name: 'Face Pull',
      description: 'Rear-delt and rotator-cuff cable exercise using a rope attachment.',
      muscle: 'Shoulders',
      equipment: 'Cable',
      difficulty: 'Beginner'
    },
    {
      id: 14,
      name: 'Kettlebell Swing',
      description: 'Explosive hip-hinge movement that develops power and conditioning.',
      muscle: 'Full Body',
      equipment: 'Kettlebell',
      difficulty: 'Intermediate'
    },
    {
      id: 15,
      name: 'Push-Up',
      description: 'Bodyweight pressing exercise for chest, shoulders, and triceps.',
      muscle: 'Chest',
      equipment: 'Bodyweight',
      difficulty: 'Beginner'
    },
    {
      id: 16,
      name: 'Seated Row',
      description: 'Cable rowing exercise that targets the mid-back and biceps.',
      muscle: 'Back',
      equipment: 'Cable',
      difficulty: 'Beginner'
    },
    {
      id: 17,
      name: 'Lunges',
      description: 'Unilateral lower body exercise for quads, glutes, and balance.',
      muscle: 'Legs',
      equipment: 'Bodyweight',
      difficulty: 'Beginner'
    },
    {
      id: 18,
      name: 'Dumbbell Shoulder Press',
      description: 'Seated or standing overhead press variation with dumbbells.',
      muscle: 'Shoulders',
      equipment: 'Dumbbell',
      difficulty: 'Intermediate'
    },
    {
      id: 19,
      name: 'Barbell Row',
      description: 'Compound rowing movement for back thickness using a barbell.',
      muscle: 'Back',
      equipment: 'Barbell',
      difficulty: 'Intermediate'
    },
    {
      id: 20,
      name: 'Leg Curl',
      description: 'Machine isolation exercise targeting the hamstrings.',
      muscle: 'Legs',
      equipment: 'Machine',
      difficulty: 'Beginner'
    },
    {
      id: 21,
      name: 'Cable Fly',
      description: 'Cable isolation exercise for the chest through a wide arc of motion.',
      muscle: 'Chest',
      equipment: 'Cable',
      difficulty: 'Intermediate'
    },
    {
      id: 22,
      name: 'Ab Wheel Rollout',
      description: 'Advanced core stability exercise using an ab wheel.',
      muscle: 'Core',
      equipment: 'Bodyweight',
      difficulty: 'Advanced'
    },
    {
      id: 23,
      name: 'Resistance Band Pull-Apart',
      description: 'Shoulder health exercise targeting the rear delts with a resistance band.',
      muscle: 'Shoulders',
      equipment: 'Resistance Band',
      difficulty: 'Beginner'
    },
    {
      id: 24,
      name: 'Goblet Squat',
      description: 'Squat variation holding a kettlebell at chest height, great for beginners.',
      muscle: 'Legs',
      equipment: 'Kettlebell',
      difficulty: 'Beginner'
    },
    {
      id: 25,
      name: 'Dips',
      description: 'Bodyweight compound movement for chest and triceps on parallel bars.',
      muscle: 'Chest',
      equipment: 'Bodyweight',
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
