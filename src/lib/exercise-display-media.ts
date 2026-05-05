import { exerciseGifFallbackUrl } from "@/lib/exercise-gif-fallback";
import { exerciseOssStaticGifFromNames } from "@/lib/exercise-oss-media";

function modernExerciseMediaEnabled(): boolean {
  return (
    typeof process.env.NEXT_PUBLIC_EXERCISEDB_GIFS === "string" &&
    ["1", "true", "yes"].includes(process.env.NEXT_PUBLIC_EXERCISEDB_GIFS.toLowerCase())
  );
}

/**
 * URL for the exercise animation.
 *
 * When `NEXT_PUBLIC_EXERCISEDB_GIFS` is true:
 * 1. [ExerciseDB OSS](https://oss.exercisedb.dev/docs) static CDN when the bundled jsDelivr map matches (same IDs).
 * 2. Same-origin `/api/exercise-gif` otherwise (OSS name lookup, then optional RapidAPI stream, then legacy redirect).
 *
 * When off: DB `gif_url`, then bundled jsDelivr fallbacks.
 */
export function exerciseAnimationSrc(args: {
  canonicalName: string | null | undefined;
  unmappedName?: string | null;
  storedGifUrl: string | null | undefined;
}): string | null {
  const name = (args.canonicalName ?? args.unmappedName ?? "").trim() || null;

  if (modernExerciseMediaEnabled() && name) {
    const ossDirect = exerciseOssStaticGifFromNames({
      canonicalName: args.canonicalName,
      unmappedName: args.unmappedName,
    });
    if (ossDirect) return ossDirect;
    return `/api/exercise-gif?name=${encodeURIComponent(name)}`;
  }

  return args.storedGifUrl ?? exerciseGifFallbackUrl(name) ?? null;
}
