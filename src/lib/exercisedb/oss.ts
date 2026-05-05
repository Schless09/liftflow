/**
 * [ExerciseDB OSS / free v1 API](https://oss.exercisedb.dev/docs) — no API key; strict rate limits.
 */

import { unstable_cache } from "next/cache";

const OSS_API = "https://oss.exercisedb.dev/api/v1";

type OssExerciseRow = { exerciseId: string; name: string; gifUrl: string };
type OssListJson = {
  success?: boolean;
  data?: unknown;
  meta?: { hasNextPage?: boolean; nextCursor?: string };
};

function isOssRow(v: unknown): v is OssExerciseRow {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.exerciseId === "string" &&
    typeof o.name === "string" &&
    typeof o.gifUrl === "string"
  );
}

async function fetchOssGifByNameUncached(displayName: string): Promise<string | null> {
  const needle = displayName.trim().toLowerCase();
  if (!needle) return null;

  let cursor: string | undefined;
  const maxPages = 30;

  for (let page = 0; page < maxPages; page++) {
    const url = new URL(`${OSS_API}/exercises`);
    url.searchParams.set("name", needle);
    if (cursor) url.searchParams.set("cursor", cursor);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        next: { revalidate: 86_400 },
        headers: { Accept: "application/json" },
      });
    } catch {
      return null;
    }

    if (!res.ok) return null;

    let json: OssListJson;
    try {
      json = (await res.json()) as OssListJson;
    } catch {
      return null;
    }

    const rows = Array.isArray(json.data) ? json.data : [];
    for (const item of rows) {
      if (isOssRow(item) && item.name === needle) return item.gifUrl;
    }

    if (!json.meta?.hasNextPage || !json.meta.nextCursor) break;
    cursor = json.meta.nextCursor;
  }

  return null;
}

/** Exact lowercase name match against OSS list (paginated). Cached 24h per name. */
export function resolveOssGifUrlByDisplayName(displayName: string): Promise<string | null> {
  const key = displayName.trim();
  if (!key) return Promise.resolve(null);

  return unstable_cache(
    async () => fetchOssGifByNameUncached(key),
    ["exercisedb-oss-gif", key.toLowerCase()],
    { revalidate: 86_400 },
  )();
}
