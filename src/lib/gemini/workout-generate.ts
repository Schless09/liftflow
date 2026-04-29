import { GoogleGenerativeAI } from "@google/generative-ai";
import { z } from "zod";
import type {
  Feeling,
  GeneratedPlanResponse,
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

/** Gemini sometimes wraps JSON in markdown fences despite responseMimeType. */
function extractJsonText(raw: string): string {
  const t = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/m.exec(t);
  if (fence?.[1]) return fence[1].trim();
  return t;
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
  return `Athlete context: ~${p.bodyWeightLbs} lb bodyweight, age ${p.age}, goal: ${goal}. Choose splits and accessories appropriate to this (not medical advice).`;
}

export async function generateWorkoutOptions(
  feeling: Feeling,
  durationMinutes: WorkoutDurationMinutes,
  focusMuscleGroups: string[],
  recentMuscleSummary: string | undefined,
  trainingProfile: TrainingProfile | null,
  generationMode: "rotation" | "balanced" = "rotation",
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
- Muscle groups hit in the user's last 2 finished sessions (if any): ${recentMuscleSummary ?? "unknown / first sessions"}.
- Today each of the 3 workout options should PRIORITIZE these muscle groups: ${focusList}.
- Prefer exercises whose primary muscle is one of those groups. Do not repeat the exact same split in all 3 options — vary exercises and angles while staying in those focus areas.
- If a group is small (e.g. arms-only), you may add one short complementary movement, but keep most volume on the focus list.`
        : "";

  const profileBlock = trainingProfile ? `\n${profileNarrative(trainingProfile)}` : "";

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
- Use standard exercise names (bench press, squat, row, etc.).
- Each of the 3 workout options MUST fit realistically within the user's time budget and energy level below.

${constraints}
${focusRules}${profileBlock}`,
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
