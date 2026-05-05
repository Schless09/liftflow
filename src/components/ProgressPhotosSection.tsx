"use client";

import {
  deleteProgressPhoto,
  listProgressPhotos,
  uploadProgressPhoto,
  type ProgressPhotoDto,
} from "@/app/actions/progress-photos";
import { cn } from "@/lib/cn";
import { useCallback, useEffect, useState, useTransition } from "react";

function formatPhotoDate(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function ProgressPhotosSection() {
  const [photos, setPhotos] = useState<ProgressPhotoDto[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    listProgressPhotos()
      .then((list) => {
        setLoadErr(null);
        setPhotos(list);
      })
      .catch((e) => {
        setPhotos([]);
        setLoadErr(e instanceof Error ? e.message : "Could not load photos");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <section className="mt-10 border-t border-zinc-800 pt-10">
      <h2 className="text-lg font-semibold text-white">Progress photos</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Private to your account. JPEG, PNG, or WebP · max 5 MB each.
      </p>

      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          setUploadErr(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            try {
              await uploadProgressPhoto(fd);
              (e.target as HTMLFormElement).reset();
              load();
            } catch (err) {
              setUploadErr(err instanceof Error ? err.message : "Upload failed");
            }
          });
        }}
      >
        <label className="block text-sm text-zinc-400">
          Note (optional)
          <input
            type="text"
            name="note"
            maxLength={500}
            placeholder="e.g. Week 4 cut, morning fasted"
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder:text-zinc-600"
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block min-w-0 flex-1 text-sm text-zinc-400">
            Photo
            <input
              type="file"
              name="file"
              required
              accept="image/jpeg,image/png,image/webp"
              className="mt-2 block w-full text-sm text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className={cn(
              "h-12 shrink-0 rounded-xl bg-zinc-800 px-5 text-sm font-semibold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:opacity-50",
            )}
          >
            {pending ? "Uploading…" : "Upload"}
          </button>
        </div>
      </form>

      {uploadErr ? (
        <p className="mt-3 text-sm text-red-400" role="alert">
          {uploadErr}
        </p>
      ) : null}

      {loadErr ? (
        <p className="mt-6 text-sm text-amber-400/90" role="status">
          {loadErr}
        </p>
      ) : null}

      {photos && photos.length === 0 && !loadErr ? (
        <p className="mt-6 text-sm text-zinc-500">No progress photos yet.</p>
      ) : null}

      {photos && photos.length > 0 ? (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((p) => (
            <li
              key={p.id}
              className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50"
            >
              {p.signedUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL
                <img
                  src={p.signedUrl}
                  alt={p.note ?? "Progress"}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-zinc-800 text-xs text-zinc-500">
                  Preview unavailable
                </div>
              )}
              <div className="p-2">
                <p className="text-[10px] text-zinc-500">{formatPhotoDate(p.created_at)}</p>
                {p.note ? <p className="mt-1 line-clamp-2 text-xs text-zinc-300">{p.note}</p> : null}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm("Delete this progress photo?")) return;
                    startTransition(async () => {
                      try {
                        await deleteProgressPhoto(p.id);
                        load();
                      } catch (err) {
                        setUploadErr(err instanceof Error ? err.message : "Could not delete");
                      }
                    });
                  }}
                  className="mt-2 text-xs font-semibold text-red-400/90 touch-manipulation disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
