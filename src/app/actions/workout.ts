"use server";

import { parseRepRange } from "@/lib/rep-range";
import { resolveExercise } from "@/lib/exercise-resolve";
import { generateExtraLiftsForActiveSession } from "@/lib/gemini/workout-generate";
import { formatExerciseCatalogForPrompt } from "@/lib/exercise-catalog-for-prompt";
import { exerciseEquipmentMatchesPreset, resolvedGymEquipmentPreset } from "@/lib/gym-equipment-preset";
import { nextPlannedWeight } from "@/lib/progression";
import { detailedRecentLiftsForPrompt, summarizeRecentForPrompt } from "@/lib/muscle-format";
import { suggestWorkingWeight } from "@/lib/suggest-working-weight";
import { parseTrainingProfileJson } from "@/lib/training-profile-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkoutRecencyContext } from "@/lib/workout-recency-context";
import { auth } from "@clerk/nextjs/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ExerciseRow,
  Feeling,
  FinishWorkoutSummary,
  GeneratedWorkout,
  LiftHistoryEntry,
  TrainingProfile,
  WorkoutDurationMinutes,
  WorkoutExercisePlan,
} from "@/lib/types";
import type { WorkoutDetailDto } from "@/lib/db-types";
import { fetchWorkoutDetail } from "@/lib/fetch-workout-detail";
import {
  ABS_FINISHER_5_MIN,
  ABS_FINISHER_8_MIN,
  ABS_FINISHER_REP_RANGE,
  ABS_FINISHER_REST_SEC,
} from "@/lib/abs-finisher";
import { DEFAULT_REST_BETWEEN_SETS_SEC } from "@/lib/rest-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function fetchLastSession(
  supabase: SupabaseClient,
  exerciseId: string,
): Promise<{ weight: number; reps: number } | null> {
  const { data: weRows } = await supabase.from("workout_exercises").select("id").eq("exercise_id", exerciseId);

  const weIds = weRows?.map((r) => r.id) ?? [];
  if (!weIds.length) return null;

  const { data: setRow } = await supabase
    .from("sets")
    .select("actual_weight, actual_reps")
    .in("workout_exercise_id", weIds)
    .eq("completed", true)
    .not("actual_weight", "is", null)
    .not("actual_reps", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!setRow?.actual_weight || setRow.actual_reps == null) return null;
  return { weight: Number(setRow.actual_weight), reps: Number(setRow.actual_reps) };
}

async function insertGeneratedPlanExercises(
  supabase: SupabaseClient,
  workoutId: string,
  planExercises: WorkoutExercisePlan[],
  exerciseLibrary: ExerciseRow[],
  profile: TrainingProfile | null,
  startOrderIndex: number,
): Promise<void> {
  for (let i = 0; i < planExercises.length; i++) {
    const p = planExercises[i]!;
    const resolved = resolveExercise(p.name, exerciseLibrary);

    let exerciseId: string | null = null;
    let unmappedName: string | null = null;
    let last: { weight: number; reps: number } | null = null;

    if (resolved.kind === "matched") {
      exerciseId = resolved.exercise.id;
      last = await fetchLastSession(supabase, exerciseId);
    } else {
      unmappedName = resolved.query;
    }

    const setCount = Math.max(1, Math.min(12, Math.round(Number(p.sets))));
    const { low } = parseRepRange(p.rep_range);
    const suggestedFromProfile =
      profile && resolved.kind === "matched"
        ? suggestWorkingWeight(profile, resolved.exercise, p.rep_range)
        : null;
    const baseW = last?.weight ?? suggestedFromProfile ?? null;

    const { data: we, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        unmapped_name: unmappedName,
        order_index: startOrderIndex + i,
        sets: setCount,
        rep_range: p.rep_range,
        base_weight: baseW,
        last_session_reps: last?.reps ?? null,
        effective_rest_seconds: DEFAULT_REST_BETWEEN_SETS_SEC,
      })
      .select("id")
      .single();

    if (weErr || !we) throw new Error(weErr?.message ?? "Failed to add exercise");

    const plannedW = baseW;
    const setRows = Array.from({ length: setCount }, (_, idx) => ({
      workout_exercise_id: we.id,
      set_number: idx + 1,
      planned_weight: plannedW,
      planned_reps: low,
      completed: false,
    }));

    const { error: setErr } = await supabase.from("sets").insert(setRows);
    if (setErr) throw new Error(setErr.message);
  }
}

function isMissingDurationColumnError(message: string): boolean {
  return message.toLowerCase().includes("duration_minutes");
}

export async function createWorkoutFromPlan(
  feeling: Feeling,
  durationMinutes: WorkoutDurationMinutes,
  plan: GeneratedWorkout,
  trainingProfilePayload?: unknown,
) {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const supabase = await createServerSupabaseClient();
  const profile = parseTrainingProfileJson(trainingProfilePayload ?? null);

  const { data: exerciseRows, error: exErr } = await supabase.from("exercises").select("*");
  if (exErr || !exerciseRows) throw new Error(exErr?.message ?? "Failed to load exercises");

  const exercises = exerciseRows as ExerciseRow[];

  let workoutRes = await supabase
    .from("workouts")
    .insert({
      feeling,
      name: plan.name,
      duration_minutes: durationMinutes,
      user_id: userId,
    })
    .select("id")
    .single();

  if (
    workoutRes.error &&
    isMissingDurationColumnError(workoutRes.error.message)
  ) {
    workoutRes = await supabase
      .from("workouts")
      .insert({ feeling, name: plan.name, user_id: userId })
      .select("id")
      .single();
  }

  const workout = workoutRes.data;
  const wErr = workoutRes.error;

  if (wErr || !workout) throw new Error(wErr?.message ?? "Failed to create workout");

  await insertGeneratedPlanExercises(
    supabase,
    workout.id,
    plan.exercises,
    exercises,
    profile,
    0,
  );

  revalidatePath("/");
  redirect(`/workout/${workout.id}`);
}

function parseFeelingFromRow(raw: string): Feeling {
  if (raw === "strong" || raw === "meh" || raw === "tired") return raw;
  return "meh";
}

function normalizeWorkoutDuration(m: number | null): WorkoutDurationMinutes | null {
  if (m === 30 || m === 45 || m === 60) return m;
  return null;
}

type ExerciseJoinLite = { canonical_name: string; muscle_group: string };

/** Supabase may type FK joins as T | T[] depending on codegen. */
function singleExerciseJoin(
  raw: ExerciseJoinLite | ExerciseJoinLite[] | null | undefined,
): ExerciseJoinLite | null {
  if (!raw) return null;
  return Array.isArray(raw) ? raw[0] ?? null : raw;
}

export async function appendAiExtraLifts(workoutId: string, trainingProfilePayload?: unknown) {
  const supabase = await createServerSupabaseClient();
  const profile = parseTrainingProfileJson(trainingProfilePayload ?? null);

  const { data: wrow, error: wErr } = await supabase
    .from("workouts")
    .select(
      `id, feeling, duration_minutes, completed_at, workout_exercises (
      order_index, unmapped_name, exercise_id,
      exercises ( canonical_name, muscle_group ),
      sets ( completed )
    )`,
    )
    .eq("id", workoutId)
    .single();

  if (wErr || !wrow) throw new Error(wErr?.message ?? "Workout not found");
  if (wrow.completed_at) throw new Error("Workout already finished");

  const weList = wrow.workout_exercises ?? [];
  const sortedWe = [...weList].sort((a, b) => a.order_index - b.order_index);

  const existingExerciseNames = sortedWe.map((we) => {
    const ex = singleExerciseJoin(we.exercises);
    const n = ex?.canonical_name ?? we.unmapped_name;
    return n?.trim() || "Unknown";
  });

  const sessionLines = sortedWe.map((we, idx) => {
    const ex = singleExerciseJoin(we.exercises);
    const name = ex?.canonical_name ?? we.unmapped_name ?? "Exercise";
    const mg = ex?.muscle_group ?? "?";
    const sets = we.sets ?? [];
    const done = sets.filter((s) => s.completed).length;
    const total = sets.length;
    return `${idx + 1}. ${name} (${mg}) — ${done}/${total} sets logged`;
  });

  const currentSessionSummary =
    sessionLines.length > 0 ? sessionLines.join("\n") : "No exercises yet (empty session).";

  const ctx = await getWorkoutRecencyContext();
  const recentMuscleSummary = summarizeRecentForPrompt(ctx.recent);
  const recentLiftDetail = detailedRecentLiftsForPrompt(ctx.recent);

  const { data: exerciseRows, error: exErr } = await supabase.from("exercises").select("*");
  if (exErr || !exerciseRows) throw new Error(exErr?.message ?? "Failed to load exercises");
  const exercises = exerciseRows as ExerciseRow[];

  const preset = resolvedGymEquipmentPreset(profile);
  const filteredCatalogRows = exercises.filter((e) =>
    exerciseEquipmentMatchesPreset(e.equipment, preset),
  );
  const catalogSource =
    filteredCatalogRows.length > 0 ? filteredCatalogRows : exercises;

  const catalogHint = formatExerciseCatalogForPrompt(
    catalogSource.map((e) => ({ canonical_name: e.canonical_name, muscle_group: e.muscle_group })),
    ctx.suggestedFocus,
    2600,
  );

  const feeling = parseFeelingFromRow(String(wrow.feeling));
  const durationMinutes = normalizeWorkoutDuration(wrow.duration_minutes);

  const plan = await generateExtraLiftsForActiveSession({
    feeling,
    durationMinutes,
    recentMuscleSummary,
    recentLiftDetail,
    currentSessionSummary,
    existingExerciseNames,
    trainingProfile: profile,
    exerciseCatalogHint: catalogHint || null,
  });

  const { data: orderRows } = await supabase
    .from("workout_exercises")
    .select("order_index")
    .eq("workout_id", workoutId);

  const maxOrder = Math.max(-1, ...(orderRows?.map((r) => r.order_index) ?? []));

  await insertGeneratedPlanExercises(
    supabase,
    workoutId,
    plan.exercises,
    exercises,
    profile,
    maxOrder + 1,
  );

  revalidatePath(`/workout/${workoutId}`);
  revalidatePath("/");
}

export async function attachExerciseToWorkoutExercise(
  workoutExerciseId: string,
  exerciseId: string,
  trainingProfilePayload?: unknown,
) {
  const supabase = await createServerSupabaseClient();
  const profile = parseTrainingProfileJson(trainingProfilePayload ?? null);
  const { data: ex, error: exErr } = await supabase
    .from("exercises")
    .select("*")
    .eq("id", exerciseId)
    .single();
  if (exErr || !ex) throw new Error(exErr?.message ?? "Exercise not found");

  const exercise = ex as ExerciseRow;
  const last = await fetchLastSession(supabase, exercise.id);

  const { data: weRow } = await supabase
    .from("workout_exercises")
    .select("rep_range")
    .eq("id", workoutExerciseId)
    .single();
  const repRange = weRow?.rep_range ?? "8-10";

  const suggested =
    profile && last == null ? suggestWorkingWeight(profile, exercise, repRange) : null;
  const baseW = last?.weight ?? suggested ?? null;

  const { error } = await supabase
    .from("workout_exercises")
    .update({
      exercise_id: exercise.id,
      unmapped_name: null,
      base_weight: baseW,
      last_session_reps: last?.reps ?? null,
      effective_rest_seconds: DEFAULT_REST_BETWEEN_SETS_SEC,
    })
    .eq("id", workoutExerciseId);

  if (error) throw new Error(error.message);

  const { low } = parseRepRange(repRange);

  const { data: sets } = await supabase
    .from("sets")
    .select("id, set_number, completed")
    .eq("workout_exercise_id", workoutExerciseId)
    .order("set_number");

  const plannedW = baseW;
  for (const s of sets ?? []) {
    if (!s.completed) {
      await supabase
        .from("sets")
        .update({ planned_weight: plannedW, planned_reps: low })
        .eq("id", s.id);
    }
  }

  revalidatePath("/workout");
}

/** Last `limit` completed sets for this canonical exercise (any workout), newest first. */
export async function fetchLiftHistory(exerciseId: string, limit = 5): Promise<LiftHistoryEntry[]> {
  const supabase = await createServerSupabaseClient();
  const { data: weList, error: weErr } = await supabase
    .from("workout_exercises")
    .select("id")
    .eq("exercise_id", exerciseId);
  if (weErr || !weList?.length) return [];

  const weIds = weList.map((r) => r.id);
  const { data, error } = await supabase
    .from("sets")
    .select(
      `
      actual_weight,
      actual_reps,
      completed_at,
      set_number,
      workout_exercises ( workout_id, workouts ( name, completed_at, created_at ) )
    `,
    )
    .in("workout_exercise_id", weIds)
    .eq("completed", true)
    .not("actual_weight", "is", null)
    .not("actual_reps", "is", null)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error || !data?.length) return [];

  const out: LiftHistoryEntry[] = [];
  for (const row of data as unknown as {
    actual_weight: number;
    actual_reps: number;
    completed_at: string | null;
    set_number: number;
    workout_exercises: {
      workouts: { name: string | null } | { name: string | null }[] | null;
    } | null;
  }[]) {
    const wRaw = row.workout_exercises?.workouts;
    const w = Array.isArray(wRaw) ? wRaw[0] : wRaw;
    out.push({
      weight: Number(row.actual_weight),
      reps: Number(row.actual_reps),
      completedAt: row.completed_at ?? "",
      setNumber: row.set_number,
      workoutName: w?.name ?? null,
    });
  }
  return out;
}

export async function fetchSwapAlternatives(exerciseId: string): Promise<ExerciseRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data: self } = await supabase.from("exercises").select("muscle_group").eq("id", exerciseId).single();
  if (!self?.muscle_group) return [];

  const { data: alts } = await supabase
    .from("exercises")
    .select("*")
    .eq("muscle_group", self.muscle_group)
    .neq("id", exerciseId)
    .limit(12);

  const list = (alts ?? []) as ExerciseRow[];
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

export async function swapExercise(
  workoutExerciseId: string,
  newExerciseId: string,
  trainingProfilePayload?: unknown,
) {
  await attachExerciseToWorkoutExercise(workoutExerciseId, newExerciseId, trainingProfilePayload);
}

/** Deletes one exercise slot and all of its sets (DB cascade). Workout must be in progress. */
export async function removeWorkoutExercise(params: {
  workoutExerciseId: string;
  workoutId: string;
}) {
  const supabase = await createServerSupabaseClient();

  const { data: w, error: wErr } = await supabase
    .from("workouts")
    .select("id, completed_at")
    .eq("id", params.workoutId)
    .single();

  if (wErr || !w) throw new Error(wErr?.message ?? "Workout not found");
  if (w.completed_at) throw new Error("Workout already finished");

  const { data: we, error: weErr } = await supabase
    .from("workout_exercises")
    .select("id, workout_id")
    .eq("id", params.workoutExerciseId)
    .single();

  if (weErr || !we) throw new Error(weErr?.message ?? "Exercise not found");
  if (we.workout_id !== params.workoutId) {
    throw new Error("Exercise does not belong to this workout");
  }

  const { error: delErr } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("id", params.workoutExerciseId);

  if (delErr) throw new Error(delErr.message);

  revalidatePath(`/workout/${params.workoutId}`);
  revalidatePath("/");
}

export async function appendAbsFinisher(workoutId: string, minutes: 5 | 8) {
  const supabase = await createServerSupabaseClient();
  const plan = minutes === 5 ? ABS_FINISHER_5_MIN : ABS_FINISHER_8_MIN;
  const names = [...plan];

  const { data: exRows, error: exErr } = await supabase
    .from("exercises")
    .select("id, canonical_name")
    .in("canonical_name", names);

  if (exErr) throw new Error(exErr.message);

  const byName = new Map((exRows ?? []).map((r) => [r.canonical_name, r.id]));
  const orderedIds = names.map((n) => byName.get(n)).filter((id): id is string => Boolean(id));

  if (orderedIds.length === 0) throw new Error("No abs finisher exercises found in library");

  const { data: weRows } = await supabase
    .from("workout_exercises")
    .select("order_index")
    .eq("workout_id", workoutId);

  const maxOrder = Math.max(-1, ...(weRows?.map((r) => r.order_index) ?? []));
  const { low } = parseRepRange(ABS_FINISHER_REP_RANGE);

  for (let i = 0; i < orderedIds.length; i++) {
    const exerciseId = orderedIds[i]!;
    const { data: we, error: weErr } = await supabase
      .from("workout_exercises")
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        unmapped_name: null,
        order_index: maxOrder + 1 + i,
        sets: 1,
        rep_range: ABS_FINISHER_REP_RANGE,
        base_weight: null,
        last_session_reps: null,
        effective_rest_seconds: ABS_FINISHER_REST_SEC,
      })
      .select("id")
      .single();

    if (weErr || !we) throw new Error(weErr?.message ?? "Failed to add abs finisher move");

    const { error: setErr } = await supabase.from("sets").insert({
      workout_exercise_id: we.id,
      set_number: 1,
      planned_weight: null,
      planned_reps: low,
      completed: false,
    });

    if (setErr) throw new Error(setErr.message);
  }

  revalidatePath(`/workout/${workoutId}`);
}

export async function completeSetAndProgress(params: {
  setId: string;
  workoutExerciseId: string;
  workoutId: string;
  repRange: string;
  actualWeight: number;
  actualReps: number;
}) {
  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  await supabase
    .from("sets")
    .update({
      actual_weight: params.actualWeight,
      actual_reps: params.actualReps,
      completed: true,
      completed_at: now,
    })
    .eq("id", params.setId);

  const { data: nextSet } = await supabase
    .from("sets")
    .select("id, set_number")
    .eq("workout_exercise_id", params.workoutExerciseId)
    .eq("completed", false)
    .order("set_number")
    .limit(1)
    .maybeSingle();

  if (nextSet) {
    const nextWeight = nextPlannedWeight(params.repRange, params.actualReps, params.actualWeight);
    await supabase
      .from("sets")
      .update({ planned_weight: nextWeight })
      .eq("id", nextSet.id);
  }

  revalidatePath(`/workout/${params.workoutId}`);
}

/** Fix weight/reps on an already-completed set (does not re-run progression). */
export async function updateLoggedSet(params: {
  setId: string;
  workoutId: string;
  actualWeight: number;
  actualReps: number;
}) {
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("sets")
    .update({
      actual_weight: params.actualWeight,
      actual_reps: params.actualReps,
    })
    .eq("id", params.setId)
    .eq("completed", true);

  if (error) throw new Error(error.message);
  revalidatePath(`/workout/${params.workoutId}`);
}

type CompletedSetRow = {
  actual_weight: number | null;
  actual_reps: number | null;
  planned_reps: number | null;
};

function repComparisonFromSets(setRows: CompletedSetRow[] | null | undefined) {
  let plannedRepsTotal = 0;
  let actualRepsTotal = 0;
  let repsOverPlan = 0;
  let repsUnderPlan = 0;
  let setsOverPlan = 0;
  let setsUnderPlan = 0;
  let setsOnPlan = 0;
  let repsComparedSets = 0;

  for (const r of setRows ?? []) {
    if (r.actual_reps == null || r.planned_reps == null) continue;
    const a = Number(r.actual_reps);
    const p = Number(r.planned_reps);
    if (!Number.isFinite(a) || !Number.isFinite(p)) continue;
    repsComparedSets++;
    plannedRepsTotal += p;
    actualRepsTotal += a;
    if (a > p) {
      setsOverPlan++;
      repsOverPlan += a - p;
    } else if (a < p) {
      setsUnderPlan++;
      repsUnderPlan += p - a;
    } else {
      setsOnPlan++;
    }
  }

  return {
    repsComparedSets,
    plannedRepsTotal,
    actualRepsTotal,
    repsOverPlan,
    repsUnderPlan,
    setsOverPlan,
    setsUnderPlan,
    setsOnPlan,
  };
}

function buildFinishSummary(
  volume: number,
  previousVolume: number | null,
  meta: {
    name: string;
    durationMinutes: number | null;
    exerciseCount: number;
    setsCompleted: number;
    createdAt: string;
    completedAt: string;
    repStats: ReturnType<typeof repComparisonFromSets>;
  },
): FinishWorkoutSummary {
  const elapsedSeconds = Math.max(
    0,
    Math.round(
      (new Date(meta.completedAt).getTime() - new Date(meta.createdAt).getTime()) / 1000,
    ),
  );
  return {
    volume,
    previousVolume,
    workoutName: meta.name,
    durationMinutesPlanned: meta.durationMinutes,
    exerciseCount: meta.exerciseCount,
    setsCompleted: meta.setsCompleted,
    elapsedSeconds,
    ...meta.repStats,
  };
}

export type WorkoutHistoryListRow = {
  id: string;
  name: string;
  created_at: string;
  completed_at: string | null;
  duration_minutes: number | null;
  total_volume: number | null;
};

/** Recent workouts for the home feed (newest first). */
export async function listWorkoutHistory(limit = 40): Promise<WorkoutHistoryListRow[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, name, created_at, completed_at, duration_minutes, total_volume")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    completed_at: r.completed_at,
    duration_minutes: r.duration_minutes,
    total_volume: r.total_volume != null ? Number(r.total_volume) : null,
  }));
}

/** Latest in-progress workout, if any. */
export async function getActiveWorkoutSummary(): Promise<{ id: string; name: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, name")
    .is("completed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { id: data.id, name: data.name };
}

/** Full workout graph for read-only summary / recap screens. */
export async function getWorkoutDetail(workoutId: string): Promise<WorkoutDetailDto | null> {
  const supabase = await createServerSupabaseClient();
  return fetchWorkoutDetail(supabase, workoutId);
}

export async function finishWorkout(workoutId: string): Promise<FinishWorkoutSummary> {
  const supabase = await createServerSupabaseClient();

  const { data: weIds } = await supabase.from("workout_exercises").select("id").eq("workout_id", workoutId);
  const ids = weIds?.map((r) => r.id) ?? [];

  const { data: setRows } =
    ids.length === 0
      ? { data: [] as CompletedSetRow[] }
      : await supabase
          .from("sets")
          .select("actual_weight, actual_reps, planned_reps")
          .in("workout_exercise_id", ids)
          .eq("completed", true);

  const repStats = repComparisonFromSets(setRows as CompletedSetRow[] | null | undefined);

  let volume = 0;
  for (const r of setRows ?? []) {
    if (r.actual_weight != null && r.actual_reps != null) {
      volume += Number(r.actual_weight) * Number(r.actual_reps);
    }
  }

  const exerciseCount = ids.length;
  const setsCompleted = setRows?.length ?? 0;

  const { data: self } = await supabase
    .from("workouts")
    .select("created_at, completed_at, total_volume, name, duration_minutes")
    .eq("id", workoutId)
    .single();

  if (!self) throw new Error("Workout not found");

  if (self.completed_at) {
    const { data: prev } = await supabase
      .from("workouts")
      .select("total_volume")
      .not("completed_at", "is", null)
      .neq("id", workoutId)
      .lt("created_at", self.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return buildFinishSummary(
      Number(self.total_volume ?? volume),
      prev?.total_volume != null ? Number(prev.total_volume) : null,
      {
        name: self.name || "Workout",
        durationMinutes: self.duration_minutes,
        exerciseCount,
        setsCompleted,
        createdAt: self.created_at,
        completedAt: self.completed_at,
        repStats,
      },
    );
  }

  const { data: prev } = await supabase
    .from("workouts")
    .select("id, total_volume")
    .not("completed_at", "is", null)
    .neq("id", workoutId)
    .lt("created_at", self.created_at)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const completedAt = new Date().toISOString();

  await supabase
    .from("workouts")
    .update({
      completed_at: completedAt,
      total_volume: volume,
    })
    .eq("id", workoutId);

  revalidatePath(`/workout/${workoutId}/end`);
  revalidatePath(`/workout/${workoutId}/summary`);
  revalidatePath("/");
  revalidatePath("/workout");
  return buildFinishSummary(volume, prev?.total_volume != null ? Number(prev.total_volume) : null, {
    name: self.name || "Workout",
    durationMinutes: self.duration_minutes,
    exerciseCount,
    setsCompleted,
    createdAt: self.created_at,
    completedAt,
    repStats,
  });
}
