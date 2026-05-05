"use client";

import type { WorkoutDetailDto } from "@/lib/db-types";
import { cn } from "@/lib/cn";
import { repRangeIsTimeBased } from "@/lib/rep-range";
import Link from "next/link";

function formatFinished(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short",
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

function formatFeeling(f: string) {
  if (!f) return "";
  return f.charAt(0).toUpperCase() + f.slice(1);
}

function ExerciseSetBreakdown({ workout }: { workout: WorkoutDetailDto }) {
  const sorted = [...(workout.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div className="mt-4 space-y-6">
      {sorted.map((we) => {
        const title = we.exercises?.canonical_name ?? we.unmapped_name ?? "Exercise";
        const timeBased = repRangeIsTimeBased(we.rep_range);
        const unit = timeBased ? "sec" : "reps";
        const setsOrd = [...(we.sets ?? [])].sort((a, b) => a.set_number - b.set_number);

        return (
          <section key={we.id} className="rounded-2xl border border-zinc-800/90 bg-zinc-900/40 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="mt-0.5 text-xs text-zinc-500">Target {we.rep_range}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-2">
              {setsOrd.map((s) => {
                const done = s.completed && s.actual_weight != null && s.actual_reps != null;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-xl px-3 py-2.5 text-sm",
                      done ? "bg-zinc-800/70" : "bg-zinc-800/30",
                    )}
                  >
                    <span className="font-medium text-zinc-400">Set {s.set_number}</span>
                    {done ? (
                      <p className="mt-0.5 tabular-nums text-white">
                        {s.actual_weight} lbs × {s.actual_reps} {unit}
                      </p>
                    ) : (
                      <p className="mt-0.5 text-zinc-500">
                        Planned{" "}
                        {s.planned_weight != null ? `${s.planned_weight} lbs` : "—"} ×{" "}
                        {s.planned_reps != null ? `${s.planned_reps} ${unit}` : "—"}
                        <span className="text-zinc-600"> · not logged</span>
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

type Props = {
  workout: WorkoutDetailDto;
  /** `embedded`: set-by-set list only (e.g. under session-complete stats). */
  variant?: "page" | "embedded";
};

export function CompletedWorkoutDetail({ workout, variant = "page" }: Props) {
  const completedAt = workout.completed_at;
  if (!completedAt) return null;

  const sorted = [...(workout.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);

  let computedVolume = 0;
  for (const we of sorted) {
    for (const s of we.sets ?? []) {
      if (s.completed && s.actual_weight != null && s.actual_reps != null) {
        computedVolume += Number(s.actual_weight) * Number(s.actual_reps);
      }
    }
  }
  const volume =
    workout.total_volume != null && Number.isFinite(Number(workout.total_volume))
      ? Number(workout.total_volume)
      : computedVolume;

  const setsLogged = sorted.reduce(
    (n, we) => n + (we.sets ?? []).filter((s) => s.completed && s.actual_weight != null).length,
    0,
  );

  if (variant === "embedded") {
    return (
      <section className="relative mt-10 border-t border-zinc-800/90 pt-10" aria-labelledby="workout-breakdown-heading">
        <h2
          id="workout-breakdown-heading"
          className="text-sm font-semibold uppercase tracking-wide text-zinc-500"
        >
          What you logged
        </h2>
        <ExerciseSetBreakdown workout={workout} />
      </section>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-8">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="rounded-lg px-2 py-2 text-sm font-medium text-zinc-400 touch-manipulation active:bg-zinc-800"
        >
          ← Home
        </Link>
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-emerald-500/90">Session log</p>
      <h1 className="mt-2 text-2xl font-bold leading-tight text-white">{workout.name || "Workout"}</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Finished <span className="text-zinc-300">{formatFinished(completedAt)}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {workout.duration_minutes != null ? <span>{workout.duration_minutes} min plan</span> : null}
        {workout.feeling ? (
          <span>
            Felt <span className="text-zinc-400">{formatFeeling(workout.feeling)}</span>
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Volume</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">
            {Math.round(volume).toLocaleString()}
            <span className="ml-1 text-sm font-medium text-zinc-500">lb·reps</span>
          </p>
        </div>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Sets logged</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-white">{setsLogged}</p>
        </div>
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Exercises & sets</h2>
      <ExerciseSetBreakdown workout={workout} />

      <Link
        href="/workout"
        className={cn(
          "mt-10 flex min-h-12 items-center justify-center rounded-2xl border border-zinc-600 text-sm font-semibold text-zinc-200",
          "touch-manipulation active:bg-zinc-800",
        )}
      >
        Workout hub
      </Link>
    </main>
  );
}
