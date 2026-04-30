/** True when the plan text describes time (planks, holds) rather than rep count. */
export function repRangeIsTimeBased(repRange: string): boolean {
  return /\b(sec|second|seconds|min|minute|minutes|hold)\b/i.test(repRange);
}

export function parseRepRange(repRange: string): { low: number; high: number } {
  const normalized = repRange.replace(/\s*to\s*/i, "-").trim();
  const parts = normalized.split(/[-–]/).map((s) => s.trim());
  if (parts.length >= 2) {
    const low = parseInt(parts[0]!, 10);
    const high = parseInt(parts[1]!, 10);
    if (!Number.isNaN(low) && !Number.isNaN(high)) {
      return { low: Math.min(low, high), high: Math.max(low, high) };
    }
  }
  const single = parseInt(normalized, 10);
  if (!Number.isNaN(single)) return { low: single, high: single };
  return { low: 8, high: 10 };
}
