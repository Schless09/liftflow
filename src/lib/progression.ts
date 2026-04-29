import { parseRepRange } from "./rep-range";

/** Deterministic next working weight after a logged set. */
export function nextPlannedWeight(
  repRange: string,
  actualReps: number,
  currentWeight: number,
): number {
  const w = Number.isFinite(currentWeight) ? currentWeight : 0;
  const { low, high } = parseRepRange(repRange);
  if (actualReps >= high) return roundWeight(w + 5);
  if (actualReps >= low) return roundWeight(w);
  const deficit = low - actualReps;
  const drop = deficit >= 3 ? 10 : 5;
  return roundWeight(Math.max(0, w - drop));
}

function roundWeight(n: number) {
  return Math.round(n * 10) / 10;
}
