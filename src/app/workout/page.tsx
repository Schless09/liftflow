"use client";

import { getActiveWorkoutSummary } from "@/app/actions/workout";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/** Workout tab: continue active session or start a new one. */
export default function WorkoutPage() {
  const [active, setActive] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(() => {
    getActiveWorkoutSummary()
      .then((a) => {
        setErr(null);
        setActive(a);
      })
      .catch((e) => {
        setActive(null);
        setErr(e instanceof Error ? e.message : "Could not load session");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-10">
      <p className="text-sm font-medium uppercase tracking-widest text-emerald-500">LiftFlow</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Workout</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Continue where you left off, or build a new plan (feeling → AI options → train).
      </p>

      {err ? (
        <p className="mt-6 text-sm text-amber-400/90" role="status">
          {err}
        </p>
      ) : null}

      {active === undefined ? (
        <p className="mt-10 text-zinc-500">Loading…</p>
      ) : (
        <div className="mt-10 flex flex-col gap-4">
          {active ? (
            <Link
              href={`/workout/${active.id}`}
              className={cn(
                "flex min-h-16 flex-col justify-center rounded-2xl bg-emerald-600/20 px-5 py-4 ring-1 ring-emerald-500/40",
                "touch-manipulation active:bg-emerald-600/30",
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-400/90">
                Continue session
              </span>
              <span className="mt-1 font-semibold text-white">{active.name}</span>
            </Link>
          ) : null}

          <Link
            href="/workout/start"
            className={cn(
              "flex min-h-16 items-center justify-center rounded-2xl bg-emerald-500 px-5 py-4 text-lg font-bold text-zinc-950",
              "touch-manipulation active:bg-emerald-400",
            )}
          >
            Start new workout
          </Link>
        </div>
      )}
    </main>
  );
}
