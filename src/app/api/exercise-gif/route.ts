import { exerciseGifFallbackUrl } from "@/lib/exercise-gif-fallback";
import { ossStaticMediaUrlFromJsdelivr } from "@/lib/exercise-oss-media";
import { resolveOssGifUrlByDisplayName } from "@/lib/exercisedb/oss";
import { fetchExerciseGifResponse, resolveExerciseDbId } from "@/lib/exercisedb/rapidapi";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function allowedResolution(): string {
  const r = (process.env.EXERCISEDB_IMAGE_RESOLUTION ?? "180").trim();
  if (["180", "360", "720", "1080"].includes(r)) return r;
  return "180";
}

function redirectToFallback(name: string): NextResponse | null {
  const u = exerciseGifFallbackUrl(name);
  if (!u) return null;
  return NextResponse.redirect(u, 302);
}

/**
 * Resolves modern exercise GIFs:
 * 1. [ExerciseDB OSS](https://oss.exercisedb.dev/docs) static CDN (same IDs as jsDelivr fallbacks)
 * 2. OSS v1 API name search → `gifUrl` redirect
 * 3. [RapidAPI / commercial ExerciseDB](https://github.com/ExerciseDB/exercisedb-api) stream when `EXERCISEDB_RAPIDAPI_KEY` is set
 * 4. Legacy jsDelivr redirect
 */
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) {
    return new NextResponse("Missing name", { status: 400 });
  }

  const jsdelivr = exerciseGifFallbackUrl(name);
  if (jsdelivr) {
    const ossStatic = ossStaticMediaUrlFromJsdelivr(jsdelivr);
    if (ossStatic) {
      return NextResponse.redirect(ossStatic, 302);
    }
  }

  const ossListed = await resolveOssGifUrlByDisplayName(name);
  if (ossListed) {
    return NextResponse.redirect(ossListed, 302);
  }

  const apiKey = process.env.EXERCISEDB_RAPIDAPI_KEY;
  if (apiKey) {
    const id = await resolveExerciseDbId(name);
    if (id) {
      const resolution = allowedResolution();
      let imgRes: Response;
      try {
        imgRes = await fetchExerciseGifResponse(id, resolution);
      } catch {
        const redir = redirectToFallback(name);
        return redir ?? new NextResponse("Upstream error", { status: 502 });
      }

      if (imgRes.ok) {
        return new NextResponse(imgRes.body, {
          status: 200,
          headers: {
            "Content-Type": "image/gif",
            "Cache-Control": "public, max-age=86400, s-maxage=86400",
          },
        });
      }
    }
  }

  const redir = redirectToFallback(name);
  return redir ?? new NextResponse("Exercise media not found", { status: 404 });
}
