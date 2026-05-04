/** Build a compact block of real DB exercise names so Gemini aligns with fuzzy-match catalog. */

export type ExerciseCatalogRow = {
  canonical_name: string;
  muscle_group: string;
};

const DEFAULT_MAX_CHARS = 3200;

/**
 * Focus muscle groups (lowercase) listed first with more names; then other groups briefly.
 * Hard cap length for token limits.
 */
export function formatExerciseCatalogForPrompt(
  rows: ExerciseCatalogRow[],
  focusGroupsLower: string[],
  maxChars = DEFAULT_MAX_CHARS,
): string {
  if (rows.length === 0) {
    return "";
  }

  const focus = new Set(focusGroupsLower.map((g) => g.trim().toLowerCase()).filter(Boolean));
  const byGroup = new Map<string, string[]>();

  for (const r of rows) {
    const g = r.muscle_group.trim().toLowerCase();
    if (!g) continue;
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(r.canonical_name);
  }

  for (const names of byGroup.values()) {
    names.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }

  const lines: string[] = [];

  for (const fg of focusGroupsLower) {
    const key = fg.trim().toLowerCase();
    if (!key) continue;
    const names = byGroup.get(key) ?? [];
    const pick = names.slice(0, 16);
    if (pick.length > 0) {
      lines.push(`${key}: ${pick.join(", ")}`);
    }
  }

  const otherLines: string[] = [];
  const sortedKeys = [...byGroup.keys()].sort((a, b) => a.localeCompare(b));
  for (const g of sortedKeys) {
    if (focus.has(g)) continue;
    const names = byGroup.get(g) ?? [];
    const pick = names.slice(0, 10);
    if (pick.length > 0) {
      otherLines.push(`${g}: ${pick.join(", ")}`);
    }
  }

  let out =
    lines.length > 0
      ? `Prioritize names under today's focus, then mix from the rest.\n${lines.join("\n")}`
      : "";
  if (otherLines.length > 0) {
    out += `${out ? "\n\n" : ""}Other muscles (examples):\n${otherLines.join("\n")}`;
  }

  if (out.length > maxChars) {
    out = `${out.slice(0, maxChars).trimEnd()}…`;
  }
  return out.trim();
}
