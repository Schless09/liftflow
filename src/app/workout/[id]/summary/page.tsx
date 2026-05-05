import { CompletedWorkoutDetail } from "@/components/CompletedWorkoutDetail";
import { fetchWorkoutDetail } from "@/lib/fetch-workout-detail";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function WorkoutSummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const workout = await fetchWorkoutDetail(supabase, id);

  if (!workout) notFound();
  if (!workout.completed_at) {
    redirect(`/workout/${id}`);
  }

  return <CompletedWorkoutDetail workout={workout} variant="page" />;
}
