import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type {
  Feeling,
  GeneratedPlanResponse,
  GeneratedWorkout,
  TrainingProfile,
  WorkoutDurationMinutes,
} from "../types";

const exercisePlanSchema = z.object({
  name: z.string(),
  sets: z.coerce.number(),
  rep_range: z.string(),
  rest_seconds: z.coerce.number(),
});

const workoutSchema = z.object({
  name: z.string(),
  exercises: z.array(exercisePlanSchema),
});

const responseSchema = z.object({
  workouts: z.array(workoutSchema).min(1),
});

const extraLiftsOnlySchema = z.object({
  exercises: z.array(exercisePlanSchema).min(1).max(3),
});

/** Gemini sometimes wraps JSON in markdown fences despite responseMimeType. */
function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
}

function equipmentAssumptionBlock(): string {
  return `Equipment: typical gym with barbells, dumbbells, adjustable bench, cable station, and common machines (e.g. leg press, lat pulldown, leg curl). Prefer movements available with that kit.`;
}

function exerciseNamingRules(): string {
  return `Exercise naming:
- Prefer exact "name" strings from the APP LIBRARY block when it appears below; otherwise use a very close synonym that would match the same movement (e.g. same implement and pattern).
- Do not repeat the same exercise name twice in one workout option.
- Across the 3 workout options, vary primary lifts; avoid duplicating the same full exercise list in multiple options.
- Keep each option cohesive for the time budget (no redundant overlapping singles).`;
}

function buildSessionConstraints(feeling: Feeling, durationMinutes: WorkoutDurationMinutes): string {
  const time =
    durationMinutes === 30
      ? `Session budget: ~30 minutes total. Prefer 3-4 exercises, 2-4 sets each. Use rest_seconds: 75 for EVERY exercise (uniform default). Stay tight.`
      : durationMinutes === 45
        ? `Session budget: ~45 minutes total. Prefer 4-6 exercises, 3-4 sets each. Use rest_seconds: 75 for EVERY exercise (uniform default).`
        : `Session budget: ~60 minutes total. Prefer 5-7 exercises, 3-5 sets each. Use rest_seconds: 75 for EVERY exercise (uniform default).`;

  const energy =
    feeling === "tired"
      ? `Energy: tired — use the LOW end of exercise count and sets for the time budget above.`
      : feeling === "meh"
        ? `Energy: medium — middle of the road volume for the time budget.`
        : `Energy: strong — can use the upper end of exercise/sets for the time budget.`;

  return `${time}\n${energy}`;
}

function profileNarrative(p: TrainingProfile): string {
  const goal =
    p.goal === "bulk"
      ? "muscle gain / hypertrophy bias"
      : p.goal === "cut"
        ? "fat loss while preserving muscle — manageable fatigue"
        : p.goal === "recomp"
          ? "recomposition"
          : p.goal === "event"
            ? `event prep${p.eventNote ? ` (${p.eventNote})` : ""}`
            : "general maintenance";
  return `Athlete context: ~${p.bodyWeightLbs} lb bodyweight, age ${p.age}, goal: ${goal}, targets ~${p.daysPerWeek} strength days/week. Choose splits and accessories that fit that frequency (not medical advice).`;
}

export async function generateWorkoutOptions(
  feeling: Feeling,
  durationMinutes: WorkoutDurationMinutes,
  focusMuscleGroups: string[],
  recentMuscleSummary: string | undefined,
  trainingProfile: TrainingProfile | null,
  generationMode: "rotation" | "balanced" = "rotation",
  exerciseCatalogHint?: string | null,
): Promise<GeneratedPlanResponse> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const constraints = buildSessionConstraints(feeling, durationMinutes);

  const focusList = focusMuscleGroups.slice(0, 3).join(", ");
  const focusRules =
    generationMode === "balanced"
      ? `Recent training context (awareness only — not a mandate to avoid or overload specific areas):
${recentMuscleSummary ?? "No finished sessions logged yet."}

Balanced workout generation:
- Produce 3 DISTINCT options that each include push, pull, and legs/core work in proportion to the time budget.
- Do NOT apply a recovery-rotation bias; spread stimulus evenly, as if planning a fresh week.
- Vary exercise selection and angles across the 3 options.
- Optional: make one option slightly upper-emphasis, one lower-emphasis, and one evenly full-body — but all must stay balanced overall.`
      : focusList.length > 0
        ? `Rotation / recovery bias:
- Muscle groups hit in the user's last 3 finished sessions (if any): ${recentMuscleSummary ?? "unknown / first sessions"}.
- Today each of the 3 workout options should PRIORITIZE these muscle groups: ${focusList}.
- Prefer exercises whose primary muscle is one of those groups. Do not repeat the exact same split in all 3 options — vary exercises and angles while staying in those focus areas.
- If a group is small (e.g. arms-only), you may add one short complementary movement, but keep most volume on the focus list.`
        : "";

  const profileBlock = trainingProfile ? `\n${profileNarrative(trainingProfile)}` : "";

  const catalogBlock =
    exerciseCatalogHint?.trim().length ?? 0
      ? `\n\nAPP LIBRARY (use these names when possible):\n${exerciseCatalogHint!.trim()}`
      : "";

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
    systemInstruction: `You reply with ONLY a JSON object. No markdown fences. No prose before or after. No keys besides the schema.
Schema: {"workouts":[{"name":"string","exercises":[{"name":"string","sets":number,"rep_range":"string","rest_seconds":number}]}]}
Rules:
- workouts array must contain exactly 3 objects.
- rep_range format like "8-10" or "6-8".
- rest_seconds: MUST always be 75 for every exercise (uniform app default between sets).
- Each of the 3 workout options MUST fit realistically within the user's time budget and energy level below.

${equipmentAssumptionBlock()}
${exerciseNamingRules()}

${constraints}
${focusRules}${profileBlock}${catalogBlock}`,
  });

  const userLines = [
    `Feeling: ${feeling}.`,
    `Target session length: ${durationMinutes} minutes.`,
    generationMode === "balanced"
      ? "Mode: balanced — three well-rounded sessions without rotation emphasis."
      : focusList
        ? `Focus muscle groups for today: ${focusList}.`
        : "No specific focus; balance the week sensibly.",
    `Build 3 different workout options that fit the length and follow the focus rules.`,
  ];
  const result = await model.generateContent(userLines.join(" "));
  const raw = result.response.text();
  if (!raw?.trim()) throw new Error("Empty Gemini response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch {
    throw new Error("Gemini returned non-JSON");
  }

  const resultParsed = responseSchema.safeParse(parsed);
  if (!resultParsed.success) {
    throw new Error(`Invalid workout JSON: ${resultParsed.error.message}`);
  }

  const three = resultParsed.data.workouts.slice(0, 3);
  if (three.length < 3) {
    throw new Error("Expected 3 workouts from model");
  }

  return { workouts: three };
}

/** 1–3 exercises to append mid-session (uses recency + current workout context). */
export async function generateExtraLiftsForActiveSession(params: {
  feeling: Feeling;
  durationMinutes: WorkoutDurationMinutes | null;
  recentMuscleSummary: string;
  currentSessionSummary: string;
  existingExerciseNames: string[];
  trainingProfile: TrainingProfile | null;
  exerciseCatalogHint?: string | null;
}): Promise<GeneratedWorkout> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");

  const dm =
    params.durationMinutes === 30 ||
    params.durationMinutes === 45 ||
    params.durationMinutes === 60
      ? params.durationMinutes
      : 45;

  const baseConstraints = buildSessionConstraints(params.feeling, dm);
  const profileBlock = params.trainingProfile ? `\n${profileNarrative(params.trainingProfile)}` : "";
  const existing =
    params.existingExerciseNames.length > 0
      ? params.existingExerciseNames.join(", ")
      : "(none yet)";

  const catalogBlock =
    params.exerciseCatalogHint?.trim().length ?? 0
      ? `\n\nAPP LIBRARY (use these names when possible):\n${params.exerciseCatalogHint!.trim()}`
      : "";

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
    systemInstruction: `You reply with ONLY a JSON object. No markdown fences. No prose before or after. No keys besides the schema.
Schema: {"exercises":[{"name":"string","sets":number,"rep_range":"string","rest_seconds":number}]}
Rules:
- The user is ALREADY mid-workout and wants a small ADD-ON: return 1 to 3 NEW exercises total (not a full session).
- Each exercise: 2-4 sets, modest extra volume on top of what they already planned.
- rep_range like "8-12" or "6-10".
- rest_seconds MUST be 75 for every exercise.
- Prefer exact "name" strings from APP LIBRARY below when listed; otherwise a very close synonym the app can fuzzy-match.
- Do NOT repeat movements already in today's session (see forbidden list). Prefer complementary muscle groups vs what is already done or in progress.
- Do not propose two add-on exercises that are the same pattern (e.g. two horizontal presses).
- Recent finished-session summary is for rotation/recovery awareness only.

${equipmentAssumptionBlock()}

${baseConstraints}
Add-on rule: keep total add-on small enough to fit inside the remaining time implied by the session budget above — this is extra work at the end or between blocks, not a second workout.${profileBlock}${catalogBlock}

Current in-progress workout (order, completion, muscles):
${params.currentSessionSummary}

Recent finished workouts (muscle emphasis):
${params.recentMuscleSummary}

Already in this session (forbidden to duplicate): ${existing}.`,
  });

  const userLines = [
    `Athlete felt ${params.feeling} when the session started.`,
    `Original target was ~${dm} minutes; they want more work now.`,
    `Return 1-3 complementary exercises as JSON only.`,
  ];

  const result = await model.generateContent(userLines.join(" "));
  const raw = result.response.text();
  if (!raw?.trim()) throw new Error("Empty Gemini response");

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch {
    throw new Error("Gemini returned non-JSON");
  }

  const parsedEx = extraLiftsOnlySchema.safeParse(parsed);
  if (!parsedEx.success) {
    throw new Error(`Invalid extra-lifts JSON: ${parsedEx.error.message}`);
  }

  return { name: "Extra work", exercises: parsedEx.data.exercises };
}
