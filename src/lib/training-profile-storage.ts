import type { TrainingProfile } from "./types";

const PROFILE_KEY = "liftflow:training-profile";

export function getTrainingProfileFromStorage(): TrainingProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as TrainingProfile;
    if (!isValidTrainingProfile(p)) return null;
    return normalizeProfile(p);
  } catch {
    return null;
  }
}

export function saveTrainingProfileToStorage(profile: TrainingProfile): void {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(normalizeProfile(profile)));
}

function normalizeProfile(p: TrainingProfile): TrainingProfile {
  return {
    bodyWeightLbs: Math.round(p.bodyWeightLbs * 10) / 10,
    age: Math.round(p.age),
    goal: p.goal,
    eventNote: p.eventNote?.trim() || undefined,
  };
}

export function parseTrainingProfileJson(data: unknown): TrainingProfile | null {
  if (!isValidTrainingProfile(data)) return null;
  return normalizeProfile(data);
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
  return true;
}
