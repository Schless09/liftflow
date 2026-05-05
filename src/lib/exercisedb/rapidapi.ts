/**
 * Server-only helpers for [ExerciseDB](https://github.com/ExerciseDB/exercisedb-api) on RapidAPI.
 * Docs: https://edb-docs.up.railway.app/
 */

import { unstable_cache } from "next/cache";

const RAPID_HOST = "exercisedb.p.rapidapi.com";

function rapidHeaders(): HeadersInit {
  const key = process.env.EXERCISEDB_RAPIDAPI_KEY;
  if (!key) throw new Error("EXERCISEDB_RAPIDAPI_KEY is not set");
  return {
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": RAPID_HOST,
  };
}

function pickIdFromNameSearchJson(data: unknown): string | null {
  function idStr(v: unknown): string | null {
    if (typeof v === "string" && v.length > 0) return v;
    if (typeof v === "number" && Number.isFinite(v)) return String(v);
    return null;
  }

  if (data == null) return null;
  if (Array.isArray(data)) {
    const first = data[0];
    if (first && typeof first === "object" && first !== null && "id" in first) {
      return idStr((first as { id: unknown }).id);
    }
    return null;
  }
  if (typeof data === "object" && data !== null && "id" in data) {
    return idStr((data as { id: unknown }).id);
  }
  return null;
}

async function fetchExerciseIdUncached(canonicalName: string): Promise<string | null> {
  const key = process.env.EXERCISEDB_RAPIDAPI_KEY;
  if (!key) return null;

  const url = `https://${RAPID_HOST}/exercises/name/${encodeURIComponent(canonicalName)}`;
  const res = await fetch(url, {
    headers: rapidHeaders(),
    next: { revalidate: 86400 },
  });

  if (!res.ok) return null;
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }
  return pickIdFromNameSearchJson(data);
}

export function resolveExerciseDbId(canonicalName: string): Promise<string | null> {
  const name = canonicalName.trim();
  if (!name) return Promise.resolve(null);
  if (!process.env.EXERCISEDB_RAPIDAPI_KEY) return Promise.resolve(null);

  return unstable_cache(
    async () => fetchExerciseIdUncached(name),
    ["exercisedb-exercise-id", name],
    { revalidate: 86_400 },
  )();
}

export async function fetchExerciseGifResponse(
  exerciseId: string,
  resolution: string,
): Promise<Response> {
  const url = new URL(`https://${RAPID_HOST}/image`);
  url.searchParams.set("exerciseId", exerciseId);
  url.searchParams.set("resolution", resolution);

  return fetch(url.toString(), {
    headers: rapidHeaders(),
  });
}
