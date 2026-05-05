export type SetDto = {
  id: string;
  set_number: number;
  planned_weight: number | null;
  planned_reps: number | null;
  actual_weight: number | null;
  actual_reps: number | null;
  completed: boolean;
};

export type ExerciseJoinDto = {
  id: string;
  canonical_name: string;
  gif_url: string | null;
  muscle_group: string;
  default_rest_seconds: number;
} | null;

export type WorkoutExerciseDto = {
  id: string;
  exercise_id: string | null;
  unmapped_name: string | null;
  order_index: number;
  rep_range: string;
  base_weight: number | null;
  last_session_reps: number | null;
  effective_rest_seconds: number;
  exercises: ExerciseJoinDto;
  sets: SetDto[];
};

export type WorkoutDetailDto = {
  id: string;
  name: string;
  feeling: string;
  duration_minutes: number | null;
  completed_at: string | null;
  created_at?: string;
  /** Saved when workout is finalized; may be absent on older rows. */
  total_volume?: number | null;
  workout_exercises: WorkoutExerciseDto[];
};
