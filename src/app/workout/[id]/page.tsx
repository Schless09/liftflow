import { ActiveWorkout } from "@/components/ActiveWorkout";
import { fetchWorkoutDetail } from "@/lib/fetch-workout-detail";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";

export default async function WorkoutSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const data = await fetchWorkoutDetail(supabase, id);

  if (!data) notFound();

  if (data.completed_at) {
    redirect(`/workout/${id}/summary`);
  }

  return <ActiveWorkout key={data.id} workout={data} />;
}
