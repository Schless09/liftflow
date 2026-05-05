"use server";

import { auth } from "@clerk/nextjs/server";
import {
  isValidTrainingProfile,
  normalizeTrainingProfile,
} from "@/lib/training-profile-storage";
import { createServerSupabaseClient, isSupabaseAnonConfigured } from "@/lib/supabase/server";
import type { GymEquipmentPreset, TrainingGoal, TrainingProfile } from "@/lib/types";
import { revalidatePath } from "next/cache";

type ProfileRow = {
  body_weight_lbs: number | string;
  age: number;
  goal: string;
  event_note: string | null;
  days_per_week?: number | string | null;
  gym_equipment_preset?: string | null;
};

function rowToProfile(row: ProfileRow): TrainingProfile | null {
  const draft: TrainingProfile = {
    bodyWeightLbs: Number(row.body_weight_lbs),
    age: Number(row.age),
    goal: row.goal as TrainingGoal,
    daysPerWeek:
      row.days_per_week != null && row.days_per_week !== ""
        ? Number(row.days_per_week)
        : 3,
    eventNote: row.event_note ?? undefined,
    gymEquipmentPreset: (row.gym_equipment_preset ?? undefined) as GymEquipmentPreset | undefined,
  };
  if (!isValidTrainingProfile(draft)) return null;
  return normalizeTrainingProfile(draft);
}

export async function getTrainingProfileAction(): Promise<TrainingProfile | null> {
  if (!isSupabaseAnonConfigured()) {
    return null;
  }
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("training_profiles")
      .select("body_weight_lbs, age, goal, event_note, days_per_week, gym_equipment_preset")
      .maybeSingle();

    if (error || !data) return null;
    return rowToProfile(data as ProfileRow);
  } catch {
    return null;
  }
}

export async function upsertTrainingProfileAction(profile: TrainingProfile): Promise<void> {
  if (!isSupabaseAnonConfigured()) {
    throw new Error(
      "Supabase env missing: set project URL and anon or publishable key (NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, etc.).",
    );
  }
  if (!isValidTrainingProfile(profile)) {
    throw new Error("Invalid training profile");
  }
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const normalized = normalizeTrainingProfile(profile);
  const supabase = await createServerSupabaseClient();

  const { error } = await supabase.from("training_profiles").upsert(
    {
      user_id: userId,
      body_weight_lbs: normalized.bodyWeightLbs,
      age: normalized.age,
      goal: normalized.goal,
      days_per_week: normalized.daysPerWeek,
      event_note: normalized.eventNote ?? null,
      gym_equipment_preset: normalized.gymEquipmentPreset ?? "full_gym",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath("/");
  revalidatePath("/profile");
}
