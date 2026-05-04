import type { RecentWorkoutSummary } from "./types";

export function titleCaseGroup(g: string) {
  return g
    .split(/[\s_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Compact line for Gemini and UI copy. */
export function summarizeRecentForPrompt(recent: RecentWorkoutSummary[]): string {
  if (recent.length === 0) {
    return "No finished workouts in the log yet — suggest balanced plans.";
  }
  return recent
    .map((r, i) => {
      const label =
        i === 0 ? "Most recent" : i === 1 ? "Previous" : i === 2 ? "Two sessions ago" : "Earlier";
      const groups =
        r.muscleGroups.length > 0 ? r.muscleGroups.join(", ") : "no mapped muscle data";
      return `${label} (${r.name}): ${groups}`;
    })
    .join(" · ");
}
