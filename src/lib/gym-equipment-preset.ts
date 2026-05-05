import type { GymEquipmentPreset } from "./types";

const HOME_GYM = new Set(
  [
    "body weight",
    "dumbbell",
    "kettlebell",
    "barbell",
    "ez barbell",
    "olympic barbell",
    "trap bar",
    "resistance band",
    "band",
    "medicine ball",
    "weighted",
    "stability ball",
    "bosu ball",
    "rope",
    "hammer",
    "roller",
    "wheel roller",
    "tire",
  ].map((s) => s.toLowerCase()),
);

const BODYWEIGHT_ONLY = new Set(["body weight", "assisted"]);

const DUMBBELLS_BANDS = new Set(
  ["body weight", "dumbbell", "kettlebell", "resistance band", "band", "medicine ball"].map((s) =>
    s.toLowerCase(),
  ),
);

export function exerciseEquipmentMatchesPreset(
  equipmentRaw: string,
  preset: GymEquipmentPreset,
): boolean {
  const eq = equipmentRaw.trim().toLowerCase();
  if (!eq) return false;

  if (preset === "full_gym") return true;

  const set =
    preset === "home_gym"
      ? HOME_GYM
      : preset === "bodyweight_only"
        ? BODYWEIGHT_ONLY
        : DUMBBELLS_BANDS;

  return set.has(eq);
}

export function equipmentPromptBlockForPreset(preset: GymEquipmentPreset): string {
  switch (preset) {
    case "full_gym":
      return `Equipment available: commercial-style gym — barbells, dumbbells, adjustable bench, cables, common machines (leg press, lat pulldown, leg curl, smith machine, etc.). Prefer movements realistic for that setup.`;
    case "home_gym":
      return `Equipment available: home gym — barbell or trap bar and rack, dumbbells, kettlebells, adjustable bench, pull-up bar, resistance bands, medicine ball; NO cable stack, NO plate-loaded machines, NO leg press / smith unless the name explicitly fits a barbell or dumbbell variation. Prefer free weights and bands.`;
    case "bodyweight_only":
      return `Equipment available: BODYWEIGHT ONLY (plus optional assisted/bodyweight regressions). Do NOT prescribe barbells, dumbbells, cables, or machines. Use push-up, squat, lunge, plank, dip-bar, pull-up, and similar patterns.`;
    case "dumbbells_bands":
      return `Equipment available: dumbbells, kettlebells, resistance bands, medicine ball, and bodyweight only. No barbell, no cable station, no machines.`;
    default:
      return equipmentPromptBlockForPreset("full_gym");
  }
}

export function resolvedGymEquipmentPreset(
  profile: { gymEquipmentPreset?: GymEquipmentPreset } | null,
): GymEquipmentPreset {
  return profile?.gymEquipmentPreset ?? "full_gym";
}
