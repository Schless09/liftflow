"use client";

import { listWorkoutHistory, type WorkoutHistoryListRow } from "@/app/actions/workout";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Home tab: workout log / history. */
export function HomeHistoryClient() {
  const [rows, setRows] = useState<WorkoutHistoryListRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    listWorkoutHistory(50)
      .then((r) => {
        setErr(null);
        setRows(r);
      })
      .catch((e) => {
        setRows([]);
        setErr(e instanceof Error ? e.message : "Could not load workouts");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-10">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-500">LiftFlow</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Home</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Your workout history. Use <span className="text-zinc-300">Workout</span> to continue or start a
        session.
      </p>

      {err ? (
        <p className="mt-6 text-sm text-amber-400/90" role="status">
          {err}
        </p>
      ) : null}

      {rows && rows.length === 0 && !err ? (
        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-center">
          <p className="text-sm text-zinc-400">No workouts logged yet.</p>
          <Link
            href="/workout"
            className="mt-4 inline-block rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-zinc-950 touch-manipulation active:bg-emerald-500"
          >
            Go to Workout
          </Link>
        </div>
      ) : null}

      {rows && rows.length > 0 ? (
        <ul className="mt-8 flex flex-col gap-3">
          {rows.map((w) => {
            const done = w.completed_at != null;
            const href = done ? `/workout/${w.id}/summary` : `/workout/${w.id}`;
            return (
              <li key={w.id}>
                <Link
                  href={href}
                  className={cn(
                    "flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/50 px-4 py-4",
                    "touch-manipulation active:bg-zinc-800/80",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-semibold text-white">{w.name || "Workout"}</p>
                    {!done ? (
                      <span className="shrink-0 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                        In progress
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-zinc-500">
                    {done ? "Finished" : "Started"} · {formatWhen(done ? w.completed_at! : w.created_at)}
                  </p>
                  {w.duration_minutes != null ? (
                    <p className="mt-0.5 text-xs text-zinc-500">{w.duration_minutes} min plan</p>
                  ) : null}
                  {done && w.total_volume != null ? (
                    <p className="mt-2 text-sm tabular-nums text-zinc-300">
                      {Math.round(w.total_volume).toLocaleString()} lb·reps
                    </p>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
