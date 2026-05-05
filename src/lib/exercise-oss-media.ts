import { exerciseGifFallbackUrl } from "@/lib/exercise-gif-fallback";

/** Matches `0025-EIeI8Vf.gif` style paths from hasaneyldrm/exercises-dataset (same IDs as OSS). */
const JSDELIVR_EXERCISE_ID = /-([A-Za-z0-9]+)\.gif(?:\?|$)/;

/**
 * Free tier static CDN from [ExerciseDB OSS](https://oss.exercisedb.dev/docs) (180p GIFs).
 */
export function ossStaticMediaUrlFromJsdelivr(jsdelivrUrl: string): string | null {
  const m = jsdelivrUrl.match(JSDELIVR_EXERCISE_ID);
  if (!m) return null;
  return `https://static.exercisedb.dev/media/${m[1]}.gif`;
}

/**
 * Prefer OSS CDN when our bundled fallback map has a jsDelivr URL (same exercise IDs as OSS v1).
 */
export function exerciseOssStaticGifFromNames(args: {
  canonicalName: string | null | undefined;
  unmappedName?: string | null;
}): string | null {
  for (const raw of [args.canonicalName, args.unmappedName]) {
    const u = exerciseGifFallbackUrl(raw);
    if (!u) continue;
    const oss = ossStaticMediaUrlFromJsdelivr(u);
    if (oss) return oss;
  }
  return null;
}
