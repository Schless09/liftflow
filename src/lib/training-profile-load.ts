import { getTrainingProfileAction } from "@/app/actions/training-profile";
import {
  getTrainingProfileFromStorage,
  saveTrainingProfileToStorage,
} from "@/lib/training-profile-storage";
import type { TrainingProfile } from "@/lib/types";

/** Prefer Supabase (signed-in); fall back to localStorage; cache DB row locally when found. */
export async function loadTrainingProfileMerged(): Promise<TrainingProfile | null> {
  try {
    const fromDb = await getTrainingProfileAction();
    if (fromDb) {
      if (typeof window !== "undefined") {
        saveTrainingProfileToStorage(fromDb);
      }
      return fromDb;
    }
  } catch {
    /* offline or missing Supabase session */
  }
  return getTrainingProfileFromStorage();
}
