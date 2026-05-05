export type Feeling = "strong" | "meh" | "tired";

/** Target session length for AI planning and logging. */
export type WorkoutDurationMinutes = 30 | 45 | 60;

export type ExerciseRow = {
  id: string;
  canonical_name: string;
  aliases: string[];
  muscle_group: string;
  equipment: string;
  gif_url: string | null;
  default_rest_seconds: number;
  /** ExerciseDB OSS v1 id when present (seed from https://oss.exercisedb.dev). */
  exercisedb_oss_id?: string | null;
};

export type WorkoutExercisePlan = {
  name: string;
  sets: number;
  rep_range: string;
  rest_seconds: number;
};

export type GeneratedWorkout = {
  name: string;
  exercises: WorkoutExercisePlan[];
};

export type GeneratedPlanResponse = {
  workouts: GeneratedWorkout[];
};

/** Training intent — used for volume/load bias (rough heuristics). */
export type TrainingGoal = "bulk" | "cut" | "maintain" | "recomp" | "event";

export type TrainingProfile = {
  bodyWeightLbs: number;
  age: number;
  goal: TrainingGoal;
  /** Target strength days per week (1–7). */
  daysPerWeek: number;
  /** Optional: e.g. "half marathon in June" when goal is event */
  eventNote?: string;
};

export type RecentWorkoutSummary = {
  id: string;
  name: string;
  completedAt: string;
  muscleGroups: string[];
};

export type WorkoutRecencyContext = {
  recent: RecentWorkoutSummary[];
  suggestedFocus: string[];
};

export type ResolveMatched = {
  kind: "matched";
  exercise: ExerciseRow;
};

export type ResolveUnmapped = {
  kind: "unmapped";
  query: string;
};

export type ResolveResult = ResolveMatched | ResolveUnmapped;

/** Last logged performances for an exercise (for active-workout history panel). */
export type LiftHistoryEntry = {
  weight: number;
  reps: number;
  completedAt: string;
  setNumber: number;
  workoutName: string | null;
};

/** Returned when a workout is finalized on the session-complete screen. */
export type FinishWorkoutSummary = {
  volume: number;
  previousVolume: number | null;
  workoutName: string;
  durationMinutesPlanned: number | null;
  exerciseCount: number;
  setsCompleted: number;
  elapsedSeconds: number;
  /** Sets with both planned and actual reps (comparison basis). */
  repsComparedSets: number;
  plannedRepsTotal: number;
  actualRepsTotal: number;
  /** Extra reps logged above planned (per-set positive deltas, summed). */
  repsOverPlan: number;
  /** Reps short of planned (per-set shortfalls, summed). */
  repsUnderPlan: number;
  setsOverPlan: number;
  setsUnderPlan: number;
  setsOnPlan: number;
};
