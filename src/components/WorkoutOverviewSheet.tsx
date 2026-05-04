"use client";

import { cn } from "@/lib/cn";
import type { WorkoutDetailDto } from "@/lib/db-types";
import { repRangeIsTimeBased } from "@/lib/rep-range";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  workout: WorkoutDetailDto;
  currentWeIndex: number | null;
  currentSetIdx: number | null;
  canRemoveExercises: boolean;
  onRemoveExercise: (workoutExerciseId: string, displayName: string) => void;
  removeDisabled?: boolean;
  onEditCompleted: (ctx: {
    setId: string;
    workoutExerciseId: string;
    repRange: string;
    weight: number;
    reps: number;
  }) => void;
};

export function WorkoutOverviewSheet({
  open,
  onClose,
  workout,
  currentWeIndex,
  currentSetIdx,
  canRemoveExercises,
  onRemoveExercise,
  removeDisabled,
  onEditCompleted,
}: Props) {
  const tapRef = useRef<{ id: string; t: number } | null>(null);

  useEscapeKey(open, onClose);

  if (!open) return null;

  const exercises = [...(workout.workout_exercises ?? [])].sort((a, b) => a.order_index - b.order_index);

  const handleRowActivate = (setId: string, fn: () => void) => {
    const now = Date.now();
    const prev = tapRef.current;
    if (prev && prev.id === setId && now - prev.t < 360) {
      fn();
      tapRef.current = null;
    } else {
      tapRef.current = { id: setId, t: now };
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/75 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="workout-overview-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-zinc-900 shadow-xl sm:max-h-[85vh] sm:rounded-3xl">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 id="workout-overview-title" className="text-lg font-semibold text-white">
            Session outline
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-sm font-medium text-zinc-400 touch-manipulation active:bg-zinc-800"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="mb-3 text-xs text-zinc-500">
            Completed sets: double-tap a row (or double-click) to edit weight{" "}
            <span className="text-zinc-600">·</span> reps.
            {canRemoveExercises ? (
              <>
                {" "}
                <span className="text-zinc-600">·</span> Remove drops the whole exercise and all sets.
              </>
            ) : null}
          </p>
          <div className="space-y-6">
            {exercises.map((we, wi) => {
              const name = we.exercises?.canonical_name ?? we.unmapped_name ?? "Exercise";
              const timeBased = repRangeIsTimeBased(we.rep_range);
              const setsSorted = [...(we.sets ?? [])].sort((a, b) => a.set_number - b.set_number);
              return (
                <div key={we.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">{name}</p>
                      <p className="text-xs text-zinc-500">{we.rep_range}</p>
                    </div>
                    {canRemoveExercises ? (
                      <button
                        type="button"
                        disabled={removeDisabled}
                        onClick={() => onRemoveExercise(we.id, name)}
                        className={cn(
                          "shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-red-400/95",
                          "touch-manipulation active:bg-red-950/50 disabled:opacity-45",
                        )}
                      >
                        Delete
                      </button>
                    ) : null}
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {setsSorted.map((s, si) => {
                      const isCurrent = currentWeIndex === wi && currentSetIdx === si;
                      const done = s.completed && s.actual_weight != null && s.actual_reps != null;
                      const unit = timeBased ? "sec" : "reps";
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            aria-disabled={!done}
                            onClick={() => {
                              if (!done) return;
                              handleRowActivate(s.id, () =>
                                onEditCompleted({
                                  setId: s.id,
                                  workoutExerciseId: we.id,
                                  repRange: we.rep_range,
                                  weight: Number(s.actual_weight),
                                  reps: Number(s.actual_reps),
                                }),
                              );
                            }}
                            onDoubleClick={() => {
                              if (!done) return;
                              onEditCompleted({
                                setId: s.id,
                                workoutExerciseId: we.id,
                                repRange: we.rep_range,
                                weight: Number(s.actual_weight),
                                reps: Number(s.actual_reps),
                              });
                            }}
                            className={cn(
                              "w-full rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                              isCurrent ? "bg-emerald-950/40 ring-1 ring-emerald-600/40" : "bg-zinc-800/70",
                              done
                                ? "touch-manipulation active:bg-zinc-700"
                                : "cursor-default opacity-90",
                            )}
                          >
                            <span className="font-medium text-zinc-300">Set {s.set_number}</span>
                            {done ? (
                              <span className="mt-0.5 block tabular-nums text-white">
                                {s.actual_weight} lbs × {s.actual_reps} {unit}
                              </span>
                            ) : (
                              <span className="mt-0.5 block text-zinc-400">
                                Planned{" "}
                                {s.planned_weight != null ? `${s.planned_weight} lbs` : "—"} ×{" "}
                                {s.planned_reps != null ? `${s.planned_reps} ${unit}` : "—"} · pending
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
