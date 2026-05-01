import type { TrainingProfile } from "./types";

const PROFILE_KEY = "liftflow:training-profile";

export function normalizeTrainingProfile(
  p: Pick<TrainingProfile, "bodyWeightLbs" | "age" | "goal"> &
    Partial<Pick<TrainingProfile, "daysPerWeek" | "eventNote">>,
): TrainingProfile {
  let days = p.daysPerWeek;
  if (typeof days !== "number" || !Number.isFinite(days)) days = 3;
  days = Math.min(7, Math.max(1, Math.round(days)));
  return {
    bodyWeightLbs: Math.round(p.bodyWeightLbs * 10) / 10,
    age: Math.round(p.age),
    goal: p.goal,
    daysPerWeek: days,
    eventNote: p.eventNote?.trim() || undefined,
  };
}

export function getTrainingProfileFromStorage(): TrainingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TrainingProfile;
    if (!isValidTrainingProfile(p)) return null;
    return normalizeTrainingProfile(p);
  } catch {
    return null;
  }
}

export function saveTrainingProfileToStorage(profile: TrainingProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeTrainingProfile(profile)));
}

export function parseTrainingProfileJson(data: unknown): TrainingProfile | null {
  if (!isValidTrainingProfile(data)) return null;
  return normalizeTrainingProfile(data);
}

export function isValidTrainingProfile(p: unknown): p is TrainingProfile {
  if (!p || typeof p !== "object") return false;
  const o = p as Record<string, unknown>;
  const w = Number(o.bodyWeightLbs);
  const a = Number(o.age);
  if (!Number.isFinite(w) || w < 95 || w > 500) return false;
  if (!Number.isFinite(a) || a < 14 || a > 90) return false;
  const g = o.goal;
  if (g !== "bulk" && g !== "cut" && g !== "maintain" && g !== "recomp" && g !== "event")
    return false;
  if (g === "event" && o.eventNote != null && typeof o.eventNote !== "string") return false;
  const d = o.daysPerWeek;
  if (d !== undefined && d !== null) {
    const n = Number(d);
    if (!Number.isFinite(n) || n < 1 || n > 7) return false;
  }
  return true;
}
