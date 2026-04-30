"use client";

import {
  appendAbsFinisher,
  attachExerciseToWorkoutExercise,
  completeSetAndProgress,
  fetchLiftHistory,
  fetchSwapAlternatives,
  swapExercise,
} from "@/app/actions/workout";
import type { WorkoutDetailDto } from "@/lib/db-types";
import { getTrainingProfileFromStorage } from "@/lib/training-profile-storage";
import { createBrowserClient } from "@/lib/supabase/client";
import { exerciseGifFallbackUrl } from "@/lib/exercise-gif-fallback";
import { ABS_FINISHER_REST_SEC } from "@/lib/abs-finisher";
import { DEFAULT_REST_BETWEEN_SETS_SEC } from "@/lib/rest-constants";
import type { ExerciseRow, LiftHistoryEntry } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { WorkoutElapsedTimer } from "./WorkoutElapsedTimer";
import { ExerciseView } from "./ExerciseView";
import { RestTimer } from "./RestTimer";
import { SetLogger } from "./SetLogger";
import { WorkoutProgressRing } from "./WorkoutProgressRing";
import { useEscapeKey } from "@/lib/use-escape-key";

type Cursor = { weIndex: number; setIdx: number };

const FINISHER_LS_KEY = (workoutId: string) => `liftflow:abs-finisher:${workoutId}`;
type FinisherChoice = "loading" | "unset" | "skip" | "appended";

function sortWorkout(w: WorkoutDetailDto): WorkoutDetailDto {
  return {
    ...w,
    workout_exercises: [...(w.workout_exercises ?? [])]
      .sort((a, b) => a.order_index - b.order_index)
      .map((we) => ({
        ...we,
        sets: [...(we.sets ?? [])].sort((a, b) => a.set_number - b.set_number),
      })),
  };
}

function findFirstIncomplete(w: WorkoutDetailDto): Cursor | null {
  const sorted = w.workout_exercises;
  for (let wi = 0; wi < sorted.length; wi++) {
    const we = sorted[wi]!;
    const incompleteIdx = we.sets.findIndex((s) => !s.completed);
    if (incompleteIdx >= 0) return { weIndex: wi, setIdx: incompleteIdx };
  }
  return null;
}

type Props = {
  workout: WorkoutDetailDto;
};

export function ActiveWorkout({ workout }: Props) {
  const router = useRouter();
  const profilePayload = getTrainingProfileFromStorage();
  const sorted = useMemo(() => sortWorkout(workout), [workout]);
  const cursor = useMemo(() => findFirstIncomplete(sorted), [sorted]);
  const [logOpen, setLogOpen] = useState(false);
  const [restOpen, setRestOpen] = useState(false);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_BETWEEN_SETS_SEC);
  const [pending, startTransition] = useTransition();
  const [swapOpen, setSwapOpen] = useState(false);
  const [alternatives, setAlternatives] = useState<ExerciseRow[]>([]);
  const [allExercises, setAllExercises] = useState<ExerciseRow[] | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [pickId, setPickId] = useState("");
  const [liftHistory, setLiftHistory] = useState<LiftHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [finisherLs, setFinisherLs] = useState<FinisherChoice>("loading");
  const [awaitingFinisherHydrate, setAwaitingFinisherHydrate] = useState(false);

  const sessionDone = cursor === null && sorted.workout_exercises.length > 0;

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const v = localStorage.getItem(FINISHER_LS_KEY(sorted.id));
        if (v === "skip" || v === "appended") setFinisherLs(v);
        else setFinisherLs("unset");
      } catch {
        setFinisherLs("unset");
      }
    });
  }, [sorted.id]);

  useEffect(() => {
    if (!awaitingFinisherHydrate) return;
    if (sessionDone) return;
    queueMicrotask(() => {
      setAwaitingFinisherHydrate(false);
      try {
        localStorage.setItem(FINISHER_LS_KEY(sorted.id), "appended");
      } catch {
        /* ignore */
      }
      setFinisherLs("appended");
    });
  }, [awaitingFinisherHydrate, sessionDone, sorted.id]);

  useEffect(() => {
    if (!sessionDone || sorted.completed_at) return;
    if (finisherLs === "loading" || finisherLs === "unset") return;
    if (awaitingFinisherHydrate) return;
    router.push(`/workout/${sorted.id}/end`);
  }, [sessionDone, sorted.completed_at, sorted.id, router, finisherLs, awaitingFinisherHydrate]);

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router, startTransition]);

  useEscapeKey(swapOpen, () => setSwapOpen(false));
  useEscapeKey(mapOpen, () => {
    setMapOpen(false);
    setPickId("");
  });

  const we = cursor != null ? sorted.workout_exercises[cursor.weIndex] : null;
  const setRow = we && cursor ? we.sets[cursor.setIdx] : null;

  const title = we?.exercises?.canonical_name ?? we?.unmapped_name ?? "Exercise";
  const gifUrl =
    we?.exercises?.gif_url ?? exerciseGifFallbackUrl(we?.exercises?.canonical_name) ?? null;
  const lastLine =
    we?.base_weight != null && we.last_session_reps != null
      ? `Last time: ${we.base_weight} × ${we.last_session_reps}`
      : null;

  const openSwap = async () => {
    const exId = we?.exercise_id;
    if (!exId) return;
    startTransition(async () => {
      const alts = await fetchSwapAlternatives(exId);
      setAlternatives(alts);
      setSwapOpen(true);
    });
  };

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!we?.exercise_id) {
        setLiftHistory([]);
        setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      fetchLiftHistory(we.exercise_id, 5)
        .then((rows) => {
          if (!cancelled) {
            setLiftHistory(rows);
            setHistoryLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setLiftHistory([]);
            setHistoryLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [we?.exercise_id, we?.id, setRow?.id, workout]);

  useEffect(() => {
    if (!mapOpen || allExercises) return;
    let cancelled = false;
    (async () => {
      try {
        const sb = createBrowserClient();
        const { data } = await sb.from("exercises").select("*").order("canonical_name");
        if (!cancelled && data) setAllExercises(data as ExerciseRow[]);
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapOpen, allExercises]);

  useEffect(() => {
    try {
      localStorage.setItem(
        "liftflow:active",
        JSON.stringify({ workoutId: sorted.id, at: Date.now(), cursor }),
      );
    } catch {
      /* ignore */
    }
  }, [sorted.id, cursor]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col px-4 pt-6",
        restOpen ? "pb-24" : "pb-10",
      )}
    >
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wider text-zinc-500">{sorted.name}</p>
          <p className="text-sm text-zinc-400">
            Session
            {sorted.duration_minutes != null ? (
              <span className="text-zinc-500"> · {sorted.duration_minutes} min plan</span>
            ) : null}
          </p>
          {sorted.created_at ? <WorkoutElapsedTimer startedAtIso={sorted.created_at} /> : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <WorkoutProgressRing workout={sorted} />
          <div className="flex gap-2">
          {we?.exercise_id ? (
            <button
              type="button"
              onClick={openSwap}
              className={cn(
                "rounded-xl border border-zinc-600 px-3 py-2 text-sm text-zinc-200",
                "touch-manipulation active:bg-zinc-800",
              )}
            >
              Swap
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => router.push(`/workout/${sorted.id}/end`)}
            className={cn(
              "rounded-xl bg-zinc-800 px-3 py-2 text-sm font-medium text-white",
              "touch-manipulation active:bg-zinc-700",
            )}
          >
            End
          </button>
          </div>
        </div>
      </header>

      {we && setRow && cursor ? (
        <>
          {we.unmapped_name && !we.exercise_id ? (
            <div className="mb-4 rounded-2xl border border-amber-600/50 bg-amber-950/30 p-4">
              <p className="text-sm font-medium text-amber-200">Unmapped exercise</p>
              <p className="text-xs text-amber-200/80">{we.unmapped_name}</p>
              <button
                type="button"
                onClick={() => setMapOpen(true)}
                className="mt-3 w-full rounded-xl bg-amber-600 py-3 text-sm font-semibold text-zinc-950"
              >
                Pick from library
              </button>
            </div>
          ) : null}

          <ExerciseView
            key={`${we.id}-${setRow.id}`}
            title={title}
            gifUrl={gifUrl}
            setIndex={setRow.set_number}
            totalSets={we.sets.length}
            plannedWeight={setRow.planned_weight}
            plannedReps={setRow.planned_reps}
            repRange={we.rep_range}
            lastLine={lastLine}
            liftHistory={liftHistory}
            historyLoading={historyLoading}
            hasMappedExercise={Boolean(we.exercise_id)}
            logHint="Tap Log Set when the set is done to record weight and reps."
            onDone={() => setLogOpen(true)}
          />

          <SetLogger
            key={`${setRow.id}-${logOpen}`}
            open={logOpen}
            onClose={() => setLogOpen(false)}
            repRange={we.rep_range}
            defaultWeight={setRow.planned_weight ?? we.base_weight ?? 0}
            onLog={({ weight, reps }) => {
              startTransition(async () => {
                await completeSetAndProgress({
                  setId: setRow.id,
                  workoutExerciseId: we.id,
                  workoutId: sorted.id,
                  repRange: we.rep_range,
                  actualWeight: weight,
                  actualReps: reps,
                });
                setLogOpen(false);
                setRestSeconds(we.effective_rest_seconds ?? DEFAULT_REST_BETWEEN_SETS_SEC);
                setRestOpen(true);
                refresh();
              });
            }}
          />

          <RestTimer
            active={restOpen}
            initialSeconds={restSeconds}
            onComplete={() => {
              setRestOpen(false);
              refresh();
            }}
            onSkip={() => {
              setRestOpen(false);
              refresh();
            }}
          />
        </>
      ) : !sessionDone ? (
        <p className="text-zinc-400">Loading…</p>
      ) : finisherLs !== "unset" ? (
        <p className="text-zinc-400">Wrapping up…</p>
      ) : null}

      {sessionDone && finisherLs === "unset" ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/95 px-6">
          {awaitingFinisherHydrate ? (
            <>
              <p className="text-center text-sm text-zinc-400">Adding abs finisher…</p>
              {pending ? (
                <p className="mt-2 text-center text-xs text-zinc-500">Saving to your session</p>
              ) : null}
            </>
          ) : (
            <>
          <p className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
            Main work complete
          </p>
          <p className="mt-3 text-center text-xl font-semibold text-white">Add abs finisher?</p>
          <p className="mt-2 max-w-sm text-center text-sm leading-relaxed text-zinc-400">
            Optional fast core circuit — one set per move, about{" "}
            <span className="text-zinc-300">{ABS_FINISHER_REST_SEC}s</span> rest between exercises (you
            can still skip rest or extend it).
          </p>
          <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setAwaitingFinisherHydrate(true);
                startTransition(async () => {
                  try {
                    await appendAbsFinisher(sorted.id, 5);
                    refresh();
                  } catch (err) {
                    setAwaitingFinisherHydrate(false);
                    window.alert(err instanceof Error ? err.message : "Could not add finisher");
                  }
                });
              }}
              className={cn(
                "rounded-2xl bg-emerald-600 py-4 text-base font-semibold text-white",
                "touch-manipulation active:bg-emerald-500 disabled:opacity-50",
              )}
            >
              +5 min finisher
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setAwaitingFinisherHydrate(true);
                startTransition(async () => {
                  try {
                    await appendAbsFinisher(sorted.id, 8);
                    refresh();
                  } catch (err) {
                    setAwaitingFinisherHydrate(false);
                    window.alert(err instanceof Error ? err.message : "Could not add finisher");
                  }
                });
              }}
              className={cn(
                "rounded-2xl bg-emerald-700 py-4 text-base font-semibold text-white",
                "touch-manipulation active:bg-emerald-600 disabled:opacity-50",
              )}
            >
              +8 min finisher
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                try {
                  localStorage.setItem(FINISHER_LS_KEY(sorted.id), "skip");
                } catch {
                  /* ignore */
                }
                setFinisherLs("skip");
              }}
              className={cn(
                "rounded-2xl border border-zinc-600 py-4 text-base font-semibold text-zinc-200",
                "touch-manipulation active:bg-zinc-900 disabled:opacity-50",
              )}
            >
              No thanks — end session
            </button>
          </div>
            </>
          )}
        </div>
      ) : null}

      {swapOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="swap-sheet-title"
        >
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-zinc-900 p-6 sm:rounded-3xl">
            <p id="swap-sheet-title" className="text-lg font-semibold text-white">
              Swap exercise
            </p>
            <div className="mt-4 flex flex-col gap-3">
              {alternatives.map((ex) => {
                const altGif =
                  ex.gif_url ?? exerciseGifFallbackUrl(ex.canonical_name) ?? null;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    className={cn(
                      "flex min-h-[5.25rem] items-stretch gap-4 overflow-hidden rounded-2xl bg-zinc-800 text-left text-white",
                      "touch-manipulation active:bg-zinc-700",
                    )}
                    onClick={() => {
                      if (!we?.id) return;
                      startTransition(async () => {
                        await swapExercise(we.id, ex.id, profilePayload);
                        setSwapOpen(false);
                        refresh();
                      });
                    }}
                  >
                    <div className="relative w-28 shrink-0 bg-zinc-900 sm:w-32">
                      {altGif ? (
                        // eslint-disable-next-line @next/next/no-img-element -- external GIF URLs
                        <img
                          src={altGif}
                          alt={ex.canonical_name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full min-h-[5.25rem] items-center justify-center px-2 text-center text-xs text-zinc-500">
                          No preview
                        </span>
                      )}
                    </div>
                    <span className="flex flex-1 items-center py-3 pr-4 text-base font-semibold leading-snug">
                      {ex.canonical_name}
                    </span>
                  </button>
                );
              })}
              {alternatives.length === 0 ? (
                <p className="text-sm text-zinc-500">No alternatives found.</p>
              ) : null}
              <button
                type="button"
                className="rounded-2xl border border-zinc-600 py-3 text-zinc-300"
                onClick={() => setSwapOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {mapOpen ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="map-sheet-title"
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl bg-zinc-900 sm:rounded-3xl">
            <div className="border-b border-zinc-800 p-4">
              <p id="map-sheet-title" className="font-semibold text-white">
                Choose exercise
              </p>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <select
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white"
                value={pickId}
                onChange={(e) => setPickId(e.target.value)}
                aria-label="Exercise library"
              >
                <option value="">Select…</option>
                {(allExercises ?? []).map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.canonical_name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-2xl bg-emerald-600 py-3 font-semibold text-white disabled:opacity-40"
                disabled={!pickId || !we?.id}
                onClick={() => {
                  if (!pickId || !we?.id) return;
                  startTransition(async () => {
                    await attachExerciseToWorkoutExercise(we.id, pickId, profilePayload);
                    setMapOpen(false);
                    setPickId("");
                    refresh();
                  });
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="rounded-2xl border border-zinc-600 py-3 text-zinc-300"
                onClick={() => setMapOpen(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-zinc-800 px-4 py-2 text-sm text-zinc-300">
          Saving…
        </div>
      ) : null}
    </div>
  );
}
