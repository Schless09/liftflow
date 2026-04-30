import type { ExerciseRow, ResolveResult } from "./types";

function norm(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/-/g, " ")
    .replace(/\s+/g, " ");
}

/** Substring match would confuse front plank vs side plank (e.g. "plank" ⊆ "side plank"). */
function skipPlankFuzzyMismatch(query: string, candidate: string): boolean {
  if (!query.includes("plank") || !candidate.includes("plank")) return false;
  const qSide = /\bside\b/.test(query);
  const cSide = /\bside\b/.test(candidate);
  if (qSide === cSide) return false;
  const bareFront =
    query === "plank" ||
    query === "front plank" ||
    candidate === "plank" ||
    candidate === "front plank";
  return bareFront || query === "side plank" || candidate === "side plank";
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
    if (skipPlankFuzzyMismatch(q, cn)) continue;
    if (cn.includes(q) || q.includes(cn)) return { kind: "matched", exercise: ex };
  }

  for (const ex of exercises) {
    for (const a of ex.aliases ?? []) {
      const an = norm(a);
      if (!an) continue;
      if (skipPlankFuzzyMismatch(q, an)) continue;
      if (an.includes(q) || q.includes(an)) return { kind: "matched", exercise: ex };
    }
  }

  return { kind: "unmapped", query: aiName };
}
