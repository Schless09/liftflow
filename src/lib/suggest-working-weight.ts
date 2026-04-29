import type { ExerciseRow, TrainingGoal, TrainingProfile } from "./types";
import { parseRepRange } from "./rep-range";

function roundGymWeight(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (n < 45) return Math.max(5, Math.round(n / 2.5) * 2.5);
  return Math.round(n / 5) * 5;
}

function goalMultiplier(goal: TrainingGoal): number {
  switch (goal) {
    case "bulk":
      return 1.06;
    case "cut":
      return 0.92;
    case "recomp":
      return 0.97;
    case "event":
      return 1.02;
    default:
      return 1;
  }
}

function ageMultiplier(age: number): number {
  if (age >= 65) return 0.82;
  if (age >= 55) return 0.88;
  if (age >= 45) return 0.94;
  return 1;
}

/**
 * Rough first-set working weight (lbs) from bodyweight + movement pattern.
 * Not medical advice — conservative starter for people without logged history.
 * Returns null for mostly bodyweight / unweighted patterns.
 */
export function suggestWorkingWeight(
  profile: TrainingProfile,
  exercise: ExerciseRow,
  repRange: string,
): number | null {
  const bw = profile.bodyWeightLbs;
  const { low } = parseRepRange(repRange);
  const repFactor = low <= 5 ? 1.08 : low <= 8 ? 1 : 0.93;

  const name = exercise.canonical_name.toLowerCase();
  const eq = exercise.equipment.toLowerCase();

  let pctLow = 0.35;
  let pctHigh = 0.55;
  let dumbbellPerHand = false;
  let noExternalLoad = false;

  if (/^\s*plank|hollow|dead bug|bicycle|flutter|hanging leg|leg raise|sit up|crunch|ab wheel|wheel rollout|russian twist/i.test(name)) {
    noExternalLoad = true;
  }

  if (noExternalLoad && !eq.includes("cable") && !eq.includes("machine") && !eq.includes("dumbbell") && !eq.includes("plate"))
    return null;

  if (/squat|leg press|hack squat|goblet/.test(name)) {
    pctLow = 0.68;
    pctHigh = 0.92;
  } else if (/deadlift|rdl|romanian|deficit|trap bar|sumo/.test(name)) {
    pctLow = 0.92;
    pctHigh = 1.15;
  } else if (/bench|floor press/.test(name) || /\bdips?\b/.test(name)) {
    pctLow = 0.5;
    pctHigh = 0.7;
  } else if (/overhead|shoulder press|ohp|military|arnold|landmine press/.test(name)) {
    pctLow = 0.3;
    pctHigh = 0.46;
  } else if (/row|pulldown|pull[- ]?up|chin|lat |straight arm|inverted row|muscle up|seal row|assisted pull/.test(name)) {
    pctLow = 0.38;
    pctHigh = 0.6;
  } else if (/hip thrust|glute|lunge|split squat|step[- ]?up|good morning|back extension|nordic|ghr/.test(name)) {
    pctLow = 0.5;
    pctHigh = 0.78;
  } else if (/curl|tricep|pushdown|skull|extension|fly|raise|face pull|shrug/.test(name)) {
    dumbbellPerHand = eq.includes("dumbbell");
    pctLow = dumbbellPerHand ? 0.07 : 0.22;
    pctHigh = dumbbellPerHand ? 0.16 : 0.38;
  } else if (/leg extension|leg curl|calf|adductor|abductor|sissy|wall sit/.test(name)) {
    pctLow = 0.18;
    pctHigh = 0.35;
  }

  if (eq.includes("dumbbell") && /bench press|row|shoulder press|incline/.test(name) && !dumbbellPerHand) {
    dumbbellPerHand = true;
    pctLow = 0.12;
    pctHigh = 0.22;
  }

  if (eq.includes("kettlebell") || eq.includes("ab wheel")) {
    pctLow *= 0.75;
    pctHigh *= 0.75;
  }

  if (eq.includes("machine") || eq.includes("cable")) {
    pctLow *= 0.9;
    pctHigh *= 0.9;
  }

  const mid = (pctLow + pctHigh) / 2;
  let load = bw * mid * repFactor * goalMultiplier(profile.goal) * ageMultiplier(profile.age);

  if (dumbbellPerHand) {
    load = (load / 2) * 0.95;
    return roundGymWeight(Math.min(load, 120));
  }

  if (load < 30 && !dumbbellPerHand) {
    return roundGymWeight(Math.max(45, load));
  }

  return roundGymWeight(load);
}
