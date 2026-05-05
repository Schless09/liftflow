import type { WorkoutDetailDto } from "@/lib/db-types";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Full workout + exercises + sets — same shape as active session. */
export const WORKOUT_DETAIL_SELECT = `
  id,
  name,
  feeling,
  duration_minutes,
  completed_at,
  created_at,
  total_volume,
  workout_exercises (
    id,
    exercise_id,
    unmapped_name,
    order_index,
    rep_range,
    base_weight,
    last_session_reps,
    effective_rest_seconds,
    exercises (
      id,
      canonical_name,
      gif_url,
      muscle_group,
      default_rest_seconds
    ),
    sets (
      id,
      set_number,
      planned_weight,
      planned_reps,
      actual_weight,
      actual_reps,
      completed
    )
  )
`;

export async function fetchWorkoutDetail(
  supabase: SupabaseClient,
  workoutId: string,
): Promise<WorkoutDetailDto | null> {
  const { data, error } = await supabase
    .from("workouts")
    .select(WORKOUT_DETAIL_SELECT)
    .eq("id", workoutId)
    .single();

  if (error || !data) return null;
  return data as unknown as WorkoutDetailDto;
}
