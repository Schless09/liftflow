import { generateWorkoutOptions } from "@/lib/gemini/workout-generate";
import { summarizeRecentForPrompt } from "@/lib/muscle-format";
import { parseTrainingProfileJson } from "@/lib/training-profile-storage";
import { getWorkoutRecencyContext } from "@/lib/workout-recency-context";
import type { Feeling, WorkoutDurationMinutes } from "@/lib/types";
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

    if (focusMuscleGroups.length === 0 || !recentMuscleSummary) {
      const ctx = await getWorkoutRecencyContext();
      if (focusMuscleGroups.length === 0) {
        focusMuscleGroups = [...ctx.suggestedFocus];
      }
      if (!recentMuscleSummary) {
        recentMuscleSummary = summarizeRecentForPrompt(ctx.recent);
      }
    }

    const trainingProfile = parseTrainingProfileJson(body?.trainingProfile ?? null);
    const generationMode = parseGenerationMode(body?.generationMode);

    const plan = await generateWorkoutOptions(
      feeling,
      durationMinutes,
      focusMuscleGroups,
      recentMuscleSummary,
      trainingProfile,
      generationMode,
    );
    return NextResponse.json(plan);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
