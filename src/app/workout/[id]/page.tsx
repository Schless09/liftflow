import { ActiveWorkout } from "@/components/ActiveWorkout";
import type { WorkoutDetailDto } from "@/lib/db-types";
import { createServerClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createServerClient();

  const { data, error } = await supabase
    .from("workouts")
    .select(
      `
      id,
      name,
      feeling,
      duration_minutes,
      completed_at,
      created_at,
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
    `,
    )
    .eq("id", id)
    .single();

  if (error || !data) notFound();

  if (data.completed_at) {
    redirect(`/workout/${id}/end`);
  }

  return <ActiveWorkout workout={data as unknown as WorkoutDetailDto} />;
}
