import { createServerClient } from "@/lib/supabase/server";
import { titleCaseGroup } from "@/lib/muscle-format";
import type { RecentWorkoutSummary, WorkoutRecencyContext } from "@/lib/types";

/** Count muscle-group exposure across recent workouts (one count per exercise slot). */
function countMuscleHits(
  rows: { workout_id: string; exercises: { muscle_group: string } | null }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const mg = row.exercises?.muscle_group;
    if (!mg) continue;
    counts.set(mg, (counts.get(mg) ?? 0) + 1);
  }
  return counts;
}

export async function getWorkoutRecencyContext(): Promise<WorkoutRecencyContext> {
  const supabase = createServerClient();

  const { data: allMuscleRows } = await supabase.from("exercises").select("muscle_group");
  const universe = [
    ...new Set((allMuscleRows ?? []).map((r) => r.muscle_group).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const { data: recentWorkouts } = await supabase
    .from("workouts")
    .select("id, name, completed_at")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(2);

  const recent: RecentWorkoutSummary[] = [];
  const allRecentWe: { workout_id: string; exercises: { muscle_group: string } | null }[] = [];

  for (const w of recentWorkouts ?? []) {
    const { data: wes } = await supabase
      .from("workout_exercises")
      .select("workout_id, exercises(muscle_group)")
      .eq("workout_id", w.id);

    for (const row of wes ?? []) {
      allRecentWe.push(
        row as unknown as {
          workout_id: string;
          exercises: { muscle_group: string } | null;
        },
      );
    }

    const groupsSet = new Set<string>();
    for (const row of wes ?? []) {
      const ex = row.exercises as unknown as { muscle_group: string } | null;
      if (ex?.muscle_group) groupsSet.add(ex.muscle_group);
    }
    const muscleGroups = [...groupsSet].sort((a, b) => a.localeCompare(b));
    recent.push({
      id: w.id,
      name: w.name,
      completedAt: w.completed_at!,
      muscleGroups,
    });
  }

  const hitCounts = countMuscleHits(allRecentWe);

  let suggestedFocus: string[] = [];

  if (universe.length === 0) {
    suggestedFocus = ["chest", "back", "legs"];
  } else if (hitCounts.size === 0) {
    const preferred = ["chest", "back", "quads", "shoulders", "hamstrings", "glutes"];
    for (const p of preferred) {
      if (universe.includes(p) && !suggestedFocus.includes(p)) suggestedFocus.push(p);
      if (suggestedFocus.length >= 3) break;
    }
    for (const g of universe) {
      if (suggestedFocus.length >= 3) break;
      if (!suggestedFocus.includes(g)) suggestedFocus.push(g);
    }
  } else {
    const scored = universe.map((g) => ({ g, c: hitCounts.get(g) ?? 0 }));
    scored.sort((a, b) => a.c - b.c || a.g.localeCompare(b.g));
    suggestedFocus = scored.slice(0, 3).map((s) => s.g);
  }

  if (suggestedFocus.length < 3 && universe.length > 0) {
    for (const g of universe) {
      if (suggestedFocus.length >= 3) break;
      if (!suggestedFocus.includes(g)) suggestedFocus.push(g);
    }
  }

  return {
    recent: recent.map((r) => ({
      ...r,
      muscleGroups: r.muscleGroups.map(titleCaseGroup),
    })),
    suggestedFocus: suggestedFocus.slice(0, 3),
  };
}
