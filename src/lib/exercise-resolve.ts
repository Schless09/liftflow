import type { ExerciseRow, ResolveResult } from "./types";

function norm(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

export function resolveExercise(aiName: string, exercises: ExerciseRow[]): ResolveResult {
  const q = norm(aiName);
  if (!q) return { kind: "unmapped", query: aiName };

  for (const ex of exercises) {
    if (norm(ex.canonical_name) === q) return { kind: "matched", exercise: ex };
  }

  for (const ex of exercises) {
    for (const a of ex.aliases ?? []) {
      if (norm(a) === q) return { kind: "matched", exercise: ex };
    }
  }

  for (const ex of exercises) {
    const cn = norm(ex.canonical_name);
    if (cn.includes(q) || q.includes(cn)) return { kind: "matched", exercise: ex };
  }

  for (const ex of exercises) {
    for (const a of ex.aliases ?? []) {
      const an = norm(a);
      if (!an) continue;
      if (an.includes(q) || q.includes(an)) return { kind: "matched", exercise: ex };
    }
  }

  return { kind: "unmapped", query: aiName };
}
