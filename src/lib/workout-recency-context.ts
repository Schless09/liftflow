import { createServerSupabaseClient } from "@/lib/supabase/server";
import { titleCaseGroup } from "@/lib/muscle-format";
import type { RecentExerciseLog, RecentWorkoutSummary, WorkoutRecencyContext } from "@/lib/types";

type SetRow = {
  actual_weight: unknown;
  actual_reps: unknown;
  completed: unknown;
};

type ExerciseJoin = { muscle_group: string; canonical_name: string } | null;

type WeRow = {
  workout_id: string;
  order_index: number;
  unmapped_name: string | null;
  exercises: ExerciseJoin | ExerciseJoin[] | null;
  sets: SetRow[] | null;
};

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

function singleExerciseJoin(raw: WeRow["exercises"]): ExerciseJoin {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

function formatBestEffortFromSets(sets: SetRow[] | null | undefined): string | null {
  const done = (sets ?? []).filter(
    (s) =>
      s.completed === true && s.actual_reps != null && String(s.actual_reps).trim() !== "",
  );
  if (done.length === 0) return null;

  let best = done[0]!;
  let bestScore = -1;
  for (const s of done) {
    const w = Number(s.actual_weight);
    const r = Number(s.actual_reps);
    const wSafe = Number.isFinite(w) ? w : 0;
    const rSafe = Number.isFinite(r) ? r : 0;
    const score = wSafe > 0 ? wSafe * 1000 + rSafe : rSafe;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }

  const w = Number(best.actual_weight);
  const r = Number(best.actual_reps);
  if (!Number.isFinite(r) || r <= 0) return null;

  if (Number.isFinite(w) && w > 0) {
    const rounded = Math.round(w * 10) / 10;
    const ws = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    return `${ws} lb × ${r}`;
  }
  return `${r} reps`;
}

function exerciseLogsFromWorkoutRows(rows: WeRow[]): RecentExerciseLog[] {
  const sorted = [...rows].sort((a, b) => a.order_index - b.order_index);
  return sorted.map((row) => {
    const ex = singleExerciseJoin(row.exercises);
    const name =
      ex?.canonical_name?.trim() ||
      (typeof row.unmapped_name === "string" ? row.unmapped_name.trim() : "") ||
      "Unknown";
    const mgRaw = ex?.muscle_group?.trim() ?? null;
    return {
      name,
      muscleGroup: mgRaw ? titleCaseGroup(mgRaw) : null,
      bestEffort: formatBestEffortFromSets(row.sets),
    };
  });
}

export async function getWorkoutRecencyContext(): Promise<WorkoutRecencyContext> {
  const supabase = await createServerSupabaseClient();

  const { data: allMuscleRows } = await supabase.from("exercises").select("muscle_group");
  const universe = [
    ...new Set((allMuscleRows ?? []).map((r) => r.muscle_group).filter(Boolean)),
  ].sort((a, b) => a.localeCompare(b));

  const { data: recentWorkouts } = await supabase
    .from("workouts")
    .select("id, name, completed_at")
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(3);

  const workoutIds = (recentWorkouts ?? []).map((w) => w.id);
  let batchWes: WeRow[] = [];

  if (workoutIds.length > 0) {
    const { data: wes } = await supabase
      .from("workout_exercises")
      .select(
        "workout_id, order_index, unmapped_name, exercises(muscle_group, canonical_name), sets(actual_weight, actual_reps, completed)",
      )
      .in("workout_id", workoutIds);
    batchWes = (wes ?? []) as unknown as WeRow[];
  }

  const byWorkout = new Map<string, WeRow[]>();
  for (const row of batchWes) {
    const wid = row.workout_id;
    if (!byWorkout.has(wid)) byWorkout.set(wid, []);
    byWorkout.get(wid)!.push(row);
  }

  const allRecentWe: { workout_id: string; exercises: { muscle_group: string } | null }[] = [];
  for (const row of batchWes) {
    const ex = singleExerciseJoin(row.exercises);
    allRecentWe.push({
      workout_id: row.workout_id,
      exercises: ex?.muscle_group ? { muscle_group: ex.muscle_group } : null,
    });
  }

  const recent: RecentWorkoutSummary[] = [];
  for (const w of recentWorkouts ?? []) {
    const wes = byWorkout.get(w.id) ?? [];
    const groupsSet = new Set<string>();
    for (const row of wes) {
      const ex = singleExerciseJoin(row.exercises);
      if (ex?.muscle_group) groupsSet.add(ex.muscle_group);
    }
    const muscleGroups = [...groupsSet].sort((a, b) => a.localeCompare(b));
    recent.push({
      id: w.id,
      name: w.name,
      completedAt: w.completed_at!,
      muscleGroups,
      exercises: exerciseLogsFromWorkoutRows(wes),
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
