"use client";

import { finishWorkout } from "@/app/actions/workout";
import type { FinishWorkoutSummary } from "@/lib/types";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { useEffect, useState } from "react";

type Props = { workoutId: string };

function formatSessionDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function encouragementLine(diff: number | null): string {
  if (diff == null) return "First finish logged — every session after this builds your baseline.";
  if (diff >= 15) return "Big jump from last time — that extra work shows.";
  if (diff >= 5) return "Solid uptick vs your last session.";
  if (diff >= 0) return "Volume held steady — consistency wins.";
  if (diff >= -10) return "A notch under last time — totally normal day to day.";
  return "Lighter than last session — recovery and intent still count.";
}

export function EndClient({ workoutId }: Props) {
  const [summary, setSummary] = useState<FinishWorkoutSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await finishWorkout(workoutId);
        if (!cancelled) setSummary(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to finalize");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <p className="text-red-400">{error}</p>
        <Link href="/" className="mt-6 inline-block text-emerald-400">
          Home
        </Link>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex min-h-[50vh] flex-1 flex-col items-center justify-center px-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-500"
          aria-hidden
        />
        <p className="mt-4 text-sm text-zinc-400">Saving your session…</p>
      </div>
    );
  }

  const {
    volume,
    previousVolume,
    workoutName,
    durationMinutesPlanned,
    exerciseCount,
    setsCompleted,
    elapsedSeconds,
    repsComparedSets,
    plannedRepsTotal,
    actualRepsTotal,
    repsOverPlan,
    repsUnderPlan,
    setsOverPlan,
    setsUnderPlan,
    setsOnPlan,
  } = summary;

  const diff =
    previousVolume != null && previousVolume > 0
      ? Math.round(((volume - previousVolume) / previousVolume) * 100)
      : null;

  const netRepsVsPlan = actualRepsTotal - plannedRepsTotal;

  const maxVol = Math.max(volume, previousVolume ?? 0, 1);
  const prevBarPct = previousVolume != null ? Math.min(100, (previousVolume / maxVol) * 100) : 0;
  const curBarPct = Math.min(100, (volume / maxVol) * 100);

  return (
    <main className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-12 pt-8">
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl"
        aria-hidden
      />

      <div className="relative flex flex-col items-center text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10"
          aria-hidden
        >
          <svg className="h-7 w-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-500/90">
          Session complete
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Nice work</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-zinc-400">
          <span className="text-zinc-200">{workoutName}</span>
          {durationMinutesPlanned != null ? (
            <span className="text-zinc-500"> · {durationMinutesPlanned} min plan</span>
          ) : null}
        </p>
      </div>

      <div className="relative mt-10 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl shadow-black/20 backdrop-blur-sm">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total volume</p>
        <p className="mt-2 text-4xl font-bold tabular-nums tracking-tight text-white">
          {Math.round(volume).toLocaleString()}
          <span className="ml-1.5 text-lg font-medium text-zinc-500">lb·reps</span>
        </p>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-zinc-800/80 pt-6">
          <div>
            <p className="text-xs text-zinc-500">Sets logged</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">{setsCompleted}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Exercises</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-white">{exerciseCount}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Elapsed</p>
            <p className="mt-1 font-mono text-xl font-semibold tabular-nums text-white">
              {formatSessionDuration(elapsedSeconds)}
            </p>
          </div>
        </div>
      </div>

      {repsComparedSets > 0 ? (
        <div className="relative mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/55 p-5 shadow-lg shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Reps vs plan</p>
          <p className="mt-3 text-3xl font-bold tabular-nums tracking-tight text-white">
            {actualRepsTotal}
            <span className="ml-2 text-base font-semibold text-zinc-500">logged</span>
            <span className="mx-3 text-zinc-600">/</span>
            <span className="text-zinc-300">{plannedRepsTotal}</span>
            <span className="ml-2 text-base font-semibold text-zinc-500">planned</span>
          </p>
          {netRepsVsPlan !== 0 ? (
            <p
              className={cn(
                "mt-3 text-sm font-semibold",
                netRepsVsPlan > 0 ? "text-emerald-400" : "text-amber-400/90",
              )}
            >
              Net {netRepsVsPlan > 0 ? "+" : ""}
              {netRepsVsPlan} rep{Math.abs(netRepsVsPlan) === 1 ? "" : "s"} vs targets
            </p>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">Logged the same total reps you planned.</p>
          )}
          <div className="mt-4 space-y-2.5 border-t border-zinc-800/80 pt-4 text-sm leading-snug">
            {repsOverPlan > 0 ? (
              <p className="text-emerald-400/95">
                +{repsOverPlan} rep{repsOverPlan === 1 ? "" : "s"} ahead on {setsOverPlan} set
                {setsOverPlan === 1 ? "" : "s"}
              </p>
            ) : null}
            {repsUnderPlan > 0 ? (
              <p className="text-amber-400/95">
                {repsUnderPlan} rep{repsUnderPlan === 1 ? "" : "s"} short on {setsUnderPlan} set
                {setsUnderPlan === 1 ? "" : "s"}
              </p>
            ) : null}
            {setsOnPlan > 0 && repsOverPlan === 0 && repsUnderPlan === 0 ? (
              <p className="text-zinc-400">Every set landed on its rep target.</p>
            ) : null}
            {setsOnPlan > 0 && (repsOverPlan > 0 || repsUnderPlan > 0) ? (
              <p className="text-zinc-500">
                {setsOnPlan} set{setsOnPlan === 1 ? "" : "s"} on target
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-xs text-zinc-600">
            Based on {repsComparedSets} logged set{repsComparedSets === 1 ? "" : "s"} with a planned rep
            goal.
          </p>
        </div>
      ) : null}

      <div className="relative mt-4 rounded-3xl border border-zinc-800 bg-zinc-900/50 p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Vs last finish</p>
        {previousVolume != null && previousVolume > 0 ? (
          <>
            <div className="mt-4 space-y-3">
              <div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Previous</span>
                  <span className="tabular-nums text-zinc-300">
                    {Math.round(previousVolume).toLocaleString()} lb·reps
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-zinc-500"
                    style={{ width: `${prevBarPct}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>Today</span>
                  <span className="tabular-nums text-zinc-200">
                    {Math.round(volume).toLocaleString()} lb·reps
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${curBarPct}%` }}
                  />
                </div>
              </div>
            </div>
            {diff != null ? (
              <p
                className={cn(
                  "mt-4 text-sm font-medium",
                  diff >= 0 ? "text-emerald-400" : "text-amber-400/90",
                )}
              >
                {diff >= 0 ? "+" : ""}
                {diff}% vs your last completed workout
              </p>
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">{encouragementLine(diff)}</p>
          </>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Finish a few more sessions and you’ll see volume bars and percent change here — same
              style of work, easier to spot trends.
            </p>
            <p className="mt-3 text-sm text-zinc-500">{encouragementLine(null)}</p>
          </>
        )}
      </div>

      <div className="relative mt-10 flex flex-col gap-3">
        <Link
          href="/"
          className={cn(
            "flex min-h-14 items-center justify-center rounded-2xl bg-white text-base font-semibold text-zinc-950",
            "touch-manipulation active:bg-zinc-200",
          )}
        >
          Done
        </Link>
        <Link
          href="/workout"
          className={cn(
            "flex min-h-12 items-center justify-center rounded-2xl border border-zinc-700 text-sm font-medium text-zinc-300",
            "touch-manipulation active:bg-zinc-800",
          )}
        >
          Start another workout
        </Link>
      </div>
    </main>
  );
}
