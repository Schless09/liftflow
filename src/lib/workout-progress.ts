import type { WorkoutDetailDto } from "@/lib/db-types";
import { parseRepRange } from "@/lib/rep-range";

/** Planned reps for one set toward session total (denominator). */
function targetRepsForSet(weRepRange: string, plannedReps: number | null): number {
  if (plannedReps != null && plannedReps > 0) return plannedReps;
  const { low, high } = parseRepRange(weRepRange);
  return Math.max(1, Math.round((low + high) / 2));
}

/**
 * Session progress by reps: sums planned reps for all sets vs logged reps on completed sets.
 * The current set does not count until Save (we don't track reps live on the exercise screen).
 */
export function getWorkoutRepProgress(workout: WorkoutDetailDto): {
  completedReps: number;
  totalReps: number;
  /** 0–1, capped at 1 */
  fraction: number;
} {
  let completedReps = 0;
  let totalReps = 0;

  for (const we of workout.workout_exercises ?? []) {
    for (const s of we.sets ?? []) {
      const target = targetRepsForSet(we.rep_range, s.planned_reps);
      totalReps += target;
      if (s.completed) {
        const logged = s.actual_reps ?? s.planned_reps ?? target;
        completedReps += Math.max(0, logged);
      }
    }
  }

  if (totalReps <= 0) {
    return { completedReps: 0, totalReps: 0, fraction: 0 };
  }
  const fraction = Math.min(1, completedReps / totalReps);
  return { completedReps, totalReps, fraction };
}
