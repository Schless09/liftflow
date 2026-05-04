"use client";

import { cn } from "@/lib/cn";
import { repRangeIsTimeBased } from "@/lib/rep-range";
import type { LiftHistoryEntry } from "@/lib/types";
import { useState } from "react";

type StatsTab = "current" | "history";

function formatHistoryWhen(iso: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

type Props = {
  title: string;
  gifUrl: string | null;
  setIndex: number;
  totalSets: number;
  plannedWeight: number | null;
  plannedReps: number | null;
  repRange: string;
  lastLine: string | null;
  liftHistory: LiftHistoryEntry[];
  historyLoading: boolean;
  hasMappedExercise: boolean;
  logHint?: string | null;
  onDone: () => void;
  /** When set, shows a control to drop this movement from the session entirely. */
  onRemoveFromSession?: (() => void) | null;
  removeFromSessionDisabled?: boolean;
};

export function ExerciseView({
  title,
  gifUrl,
  setIndex,
  totalSets,
  plannedWeight,
  plannedReps,
  repRange,
  lastLine,
  liftHistory,
  historyLoading,
  hasMappedExercise,
  logHint,
  onDone,
  onRemoveFromSession,
  removeFromSessionDisabled,
}: Props) {
  const [tab, setTab] = useState<StatsTab>("current");
  const timeBased = repRangeIsTimeBased(repRange);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold leading-tight text-white">{title}</h1>
        <p className="mt-1 text-zinc-400">
          Set {setIndex} / {totalSets} · {repRange}
          {timeBased ? "" : " reps"}
        </p>
        {lastLine ? <p className="mt-2 text-sm font-medium text-emerald-400/90">{lastLine}</p> : null}
        {onRemoveFromSession ? (
          <button
            type="button"
            disabled={removeFromSessionDisabled}
            onClick={onRemoveFromSession}
            className={cn(
              "mt-3 text-left text-xs font-semibold text-red-400/95 touch-manipulation",
              "underline decoration-red-400/50 underline-offset-2 disabled:opacity-45",
            )}
          >
            Delete exercise
          </button>
        ) : null}
      </div>

      <div className="relative flex aspect-video w-full max-h-64 items-center justify-center overflow-hidden rounded-2xl bg-zinc-800">
        {gifUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external GIF URLs from DB
          <img
            src={gifUrl}
            alt={`${title} demonstration`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="text-sm text-zinc-500">No demo image</span>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
        {hasMappedExercise ? (
          <div className="mb-4 flex rounded-xl bg-zinc-800/90 p-1">
            <button
              type="button"
              onClick={() => setTab("current")}
              className={cn(
                "min-h-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
                tab === "current" ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-400",
              )}
            >
              This set
            </button>
            <button
              type="button"
              onClick={() => setTab("history")}
              className={cn(
                "min-h-10 flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
                tab === "history" ? "bg-zinc-950 text-white shadow-sm" : "text-zinc-400",
              )}
            >
              Last 5 sets
            </button>
          </div>
        ) : null}

        {tab === "current" || !hasMappedExercise ? (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Set {setIndex} of {totalSets}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">Weight (target)</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {plannedWeight != null ? plannedWeight : "—"}{" "}
                  <span className="text-base font-normal text-zinc-500">lbs</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">
                  {timeBased ? "Time / hold (target)" : "Reps (target)"}
                </p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-white">
                  {plannedReps != null ? plannedReps : "—"}
                  {timeBased ? <span className="text-base font-normal text-zinc-500"> sec</span> : null}
                </p>
              </div>
            </div>
            {plannedWeight != null && !lastLine ? (
              <p className="mt-3 text-xs text-zinc-600">
                Estimate from your profile + lift pattern — adjust when you log the set.
              </p>
            ) : null}
          </>
        ) : (
          <div className="space-y-2">
            {historyLoading ? (
              <p className="py-4 text-center text-sm text-zinc-500">Loading history…</p>
            ) : liftHistory.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">
                No completed sets for this lift yet. Finish and log sets to build history.
              </p>
            ) : (
              liftHistory.map((h, i) => (
                <div
                  key={`${h.completedAt}-${h.setNumber}-${i}`}
                  className="rounded-xl bg-zinc-800/60 px-3 py-3"
                >
                  <p className="text-base font-semibold tabular-nums text-white">
                    {h.weight} lbs × {h.reps} reps
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {formatHistoryWhen(h.completedAt)}
                    {h.workoutName ? ` · ${h.workoutName}` : ""} · Set {h.setNumber}
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onDone}
        aria-label={`Log set ${setIndex} of ${totalSets} for ${title}`}
        className={cn(
          "w-full rounded-2xl bg-emerald-500 py-5 text-xl font-bold text-zinc-950",
          "touch-manipulation active:bg-emerald-400",
        )}
      >
        Log Set
      </button>
      {logHint ? <p className="text-center text-xs text-zinc-500">{logHint}</p> : null}
    </div>
  );
}
