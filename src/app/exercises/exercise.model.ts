export type MuscleGroup = 'Chest' | 'Back' | 'Shoulders' | 'Arms' | 'Legs' | 'Core' | 'Full Body';
export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Resistance Band' | 'Kettlebell';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Exercise {
  id: number;
  name: string;
  description: string;
  muscle: MuscleGroup;
  equipment: Equipment;
  difficulty: Difficulty;
}
