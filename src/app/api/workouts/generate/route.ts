import { generateWorkoutOptions } from "@/lib/gemini/workout-generate";
import { formatExerciseCatalogForPrompt } from "@/lib/exercise-catalog-for-prompt";
import { exerciseEquipmentMatchesPreset, resolvedGymEquipmentPreset } from "@/lib/gym-equipment-preset";
import { detailedRecentLiftsForPrompt, summarizeRecentForPrompt } from "@/lib/muscle-format";
import { parseTrainingProfileJson } from "@/lib/training-profile-storage";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getWorkoutRecencyContext } from "@/lib/workout-recency-context";
import type { Feeling, WorkoutDurationMinutes } from "@/lib/types";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

function parseDuration(v: unknown): WorkoutDurationMinutes | null {
  const n = Number(v);
  if (n === 30 || n === 45 || n === 60) return n;
  return null;
}

function parseFocusList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((s) => s.trim().toLowerCase())
    .slice(0, 3);
}

function parseGenerationMode(v: unknown): "rotation" | "balanced" {
  return v === "balanced" ? "balanced" : "rotation";
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const feeling = body?.feeling as Feeling | undefined;
    if (feeling !== "strong" && feeling !== "meh" && feeling !== "tired") {
      return NextResponse.json({ error: "Invalid feeling" }, { status: 400 });
    }
    const durationMinutes = parseDuration(body?.durationMinutes);
    if (durationMinutes == null) {
      return NextResponse.json({ error: "durationMinutes must be 30, 45, or 60" }, { status: 400 });
    }

    let focusMuscleGroups = parseFocusList(body?.focusMuscleGroups);
    let recentMuscleSummary =
      typeof body?.recentMuscleSummary === "string" && body.recentMuscleSummary.trim().length > 0
        ? body.recentMuscleSummary.trim()
        : undefined;

    const ctx = await getWorkoutRecencyContext();
    if (focusMuscleGroups.length === 0) {
      focusMuscleGroups = [...ctx.suggestedFocus];
    }
    if (!recentMuscleSummary) {
      recentMuscleSummary = summarizeRecentForPrompt(ctx.recent);
    }
    const recentLiftDetail = detailedRecentLiftsForPrompt(ctx.recent);

    const trainingProfile = parseTrainingProfileJson(body?.trainingProfile ?? null);
    const generationMode = parseGenerationMode(body?.generationMode);
    const preset = resolvedGymEquipmentPreset(trainingProfile);

    const supabase = await createServerSupabaseClient();
    const { data: catalogRows } = await supabase
      .from("exercises")
      .select("canonical_name, muscle_group, equipment");

    const filtered =
      (catalogRows ?? []).filter((r) =>
        exerciseEquipmentMatchesPreset(String(r.equipment ?? ""), preset),
      ) ?? [];
    const rowsForPrompt =
      filtered.length > 0 ? filtered : (catalogRows ?? []);

    const exerciseCatalogHint = formatExerciseCatalogForPrompt(
      rowsForPrompt.map((r) => ({
        canonical_name: r.canonical_name,
        muscle_group: r.muscle_group,
      })),
      focusMuscleGroups,
    );

    const plan = await generateWorkoutOptions(
      feeling,
      durationMinutes,
      focusMuscleGroups,
      recentMuscleSummary,
      recentLiftDetail,
      trainingProfile,
      generationMode,
      exerciseCatalogHint || null,
    );
    return NextResponse.json(plan);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
