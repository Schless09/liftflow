"use client";

import {
  appendAbsFinisher,
  appendAiExtraLifts,
  attachExerciseToWorkoutExercise,
  completeSetAndProgress,
  fetchLiftHistory,
  fetchSwapAlternatives,
  removeWorkoutExercise,
  swapExercise,
  updateLoggedSet,
} from "@/app/actions/workout";
import type { WorkoutDetailDto } from "@/lib/db-types";
import { loadTrainingProfileMerged } from "@/lib/training-profile-load";
import { createBrowserClient } from "@/lib/supabase/client";
import { exerciseGifFallbackUrl } from "@/lib/exercise-gif-fallback";
import { ABS_FINISHER_REST_SEC } from "@/lib/abs-finisher";
import { DEFAULT_REST_BETWEEN_SETS_SEC } from "@/lib/rest-constants";
import type { ExerciseRow, LiftHistoryEntry, TrainingProfile } from "@/lib/types";
import { cn } from "@/lib/cn";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { WorkoutElapsedTimer } from "./WorkoutElapsedTimer";
import { ExerciseView } from "./ExerciseView";
import { RestTimer } from "./RestTimer";
import { SetLogger } from "./SetLogger";
import { WorkoutOverviewSheet } from "./WorkoutOverviewSheet";
import { WorkoutProgressRing } from "./WorkoutProgressRing";
import { useEscapeKey } from "@/lib/use-escape-key";

type Cursor = { weIndex: number; setIdx: number };

const FINISHER_LS_KEY = (workoutId: string) => `liftflow:abs-finisher:${workoutId}`;
/** Show abs offer once planned-set completion reaches this fraction (e.g. 0.8 → 80%). */
const ABS_PROMPT_MIN_COMPLETION = 0.8;
type FinisherChoice = "loading" | "unset" | "skip" | "appended";

type EditLoggedSetCtx = {
  setId: string;
  workoutExerciseId: string;
  repRange: string;
  weight: number;
  reps: number;
};

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

/** Share of planned sets logged (by set count), 0–1. */
function workoutCompletionFraction(w: WorkoutDetailDto): number {
  let total = 0;
  let done = 0;
  for (const we of w.workout_exercises ?? []) {
    for (const s of we.sets ?? []) {
      total += 1;
      if (s.completed) done += 1;
    }
  }
  if (total === 0) return 0;
  return done / total;
}

type Props = {
  workout: WorkoutDetailDto;
};

export function ActiveWorkout({ workout }: Props) {
  const router = useRouter();
  const [profilePayload, setProfilePayload] = useState<TrainingProfile | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadTrainingProfileMerged().then((p) => {
      if (!cancelled) setProfilePayload(p ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const resolveProfile = useCallback(async () => {
    return profilePayload ?? (await loadTrainingProfileMerged());
  }, [profilePayload]);
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
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [editCtx, setEditCtx] = useState<EditLoggedSetCtx | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [aiExtraErr, setAiExtraErr] = useState<string | null>(null);
  const [absOfferDeferred, setAbsOfferDeferred] = useState(false);

  const sessionDone = cursor === null && sorted.workout_exercises.length > 0;
  const completionFraction = useMemo(() => workoutCompletionFraction(sorted), [sorted]);
  const pastAbsOfferThreshold = completionFraction >= ABS_PROMPT_MIN_COMPLETION;
  const absFinisherDecided = finisherLs === "skip" || finisherLs === "appended";
  const showAbsFinisherGate =
    !sorted.completed_at &&
    (finisherLs === "unset" || finisherLs === "loading") &&
    (sessionDone || (pastAbsOfferThreshold && !absOfferDeferred));

  useEffect(() => {
    setAbsOfferDeferred(false);
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

  const addAiLifts = useCallback(() => {
    if (sessionDone || sorted.completed_at) return;
    setAiExtraErr(null);
    startTransition(async () => {
      try {
        const profile = await resolveProfile();
        await appendAiExtraLifts(sorted.id, profile ?? undefined);
        router.refresh();
      } catch (e) {
        setAiExtraErr(e instanceof Error ? e.message : "Could not add lifts");
      }
    });
  }, [
    resolveProfile,
    router,
    sessionDone,
    sorted.completed_at,
    sorted.id,
    startTransition,
  ]);

  useEscapeKey(swapOpen, () => setSwapOpen(false));
  useEscapeKey(mapOpen, () => {
    setMapOpen(false);
    setPickId("");
  });
  useEscapeKey(outlineOpen, () => setOutlineOpen(false));

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

  const confirmRemoveExercise = useCallback(
    (workoutExerciseId: string, displayName: string) => {
      if (!window.confirm(`Remove "${displayName}" and all of its sets from this session?`)) return;
      startTransition(async () => {
        try {
          await removeWorkoutExercise({ workoutExerciseId, workoutId: sorted.id });
          setOutlineOpen(false);
          router.refresh();
        } catch (e) {
          window.alert(e instanceof Error ? e.message : "Could not remove exercise");
        }
      });
    },
    [router, sorted.id, startTransition],
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 flex-col px-4 pt-6",
        restOpen ? "pb-24" : "pb-10",
      )}
    >
      <header className="mb-5 space-y-3">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase leading-snug tracking-wider text-zinc-500">
              {sorted.name}
            </p>
            <p className="mt-1 text-xs leading-snug text-zinc-400 sm:text-sm">
              Session
              {sorted.duration_minutes != null ? (
                <span className="text-zinc-500"> · {sorted.duration_minutes} min plan</span>
              ) : null}
            </p>
            {sorted.created_at ? (
              <WorkoutElapsedTimer startedAtIso={sorted.created_at} className="mt-1" />
            ) : null}
          </div>
          <WorkoutProgressRing workout={sorted} />
        </div>
        <div className="-mx-1 flex max-w-[100vw] flex-wrap gap-2 px-1 sm:gap-2">
          {we?.exercise_id ? (
            <button
              type="button"
              onClick={openSwap}
              className={cn(
                "rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200",
                "touch-manipulation active:bg-zinc-800 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm",
              )}
            >
              Swap
            </button>
          ) : null}
          {!sessionDone && !sorted.completed_at ? (
            <button
              type="button"
              onClick={addAiLifts}
              disabled={pending}
              title="Uses recent workouts and today's log so far"
              className={cn(
                "rounded-lg border border-emerald-700/60 bg-emerald-950/40 px-2.5 py-1.5 text-xs font-medium text-emerald-100",
                "touch-manipulation active:bg-emerald-900/50 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm",
                pending && "opacity-50",
              )}
            >
              {pending ? "…" : "More lifts"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setOutlineOpen(true)}
            className={cn(
              "rounded-lg border border-zinc-600 px-2.5 py-1.5 text-xs font-medium text-zinc-200",
              "touch-manipulation active:bg-zinc-800 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm",
            )}
          >
            Outline
          </button>
          <button
            type="button"
            onClick={() => router.push(`/workout/${sorted.id}/end`)}
            className={cn(
              "rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs font-medium text-white",
              "touch-manipulation active:bg-zinc-700 sm:rounded-xl sm:px-3 sm:py-2 sm:text-sm",
            )}
          >
            End
          </button>
        </div>
      </header>

      {aiExtraErr ? (
        <p className="mb-4 rounded-xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {aiExtraErr}
        </p>
      ) : null}

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
            onRemoveFromSession={
              sorted.completed_at
                ? undefined
                : () => confirmRemoveExercise(we.id, title)
            }
            removeFromSessionDisabled={pending}
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

          <WorkoutOverviewSheet
            open={outlineOpen}
            onClose={() => setOutlineOpen(false)}
            workout={sorted}
            currentWeIndex={cursor?.weIndex ?? null}
            currentSetIdx={cursor?.setIdx ?? null}
            canRemoveExercises={!sorted.completed_at}
            onRemoveExercise={confirmRemoveExercise}
            removeDisabled={pending}
            onEditCompleted={(ctx) => {
              setOutlineOpen(false);
              setEditCtx(ctx);
              setEditOpen(true);
            }}
          />

          {editCtx ? (
            <SetLogger
              key={`edit-${editCtx.setId}`}
              open={editOpen}
              onClose={() => {
                setEditOpen(false);
                setEditCtx(null);
              }}
              sheetTitle="Edit logged set"
              saveButtonLabel="Update"
              repRange={editCtx.repRange}
              defaultWeight={editCtx.weight}
              initialRepsOverride={editCtx.reps}
              onLog={({ weight, reps }) => {
                startTransition(async () => {
                  await updateLoggedSet({
                    setId: editCtx.setId,
                    workoutId: sorted.id,
                    actualWeight: weight,
                    actualReps: reps,
                  });
                  setEditOpen(false);
                  setEditCtx(null);
                  refresh();
                });
              }}
            />
          ) : null}
        </>
      ) : !sessionDone ? (
        <p className="text-zinc-400">Loading…</p>
      ) : absFinisherDecided ? (
        <p className="text-zinc-400">Wrapping up…</p>
      ) : null}

      {showAbsFinisherGate ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950/95 px-6">
          {awaitingFinisherHydrate ? (
            <>
              <p className="text-center text-sm text-zinc-400">Adding abs finisher…</p>
              {pending ? (
                <p className="mt-2 text-center text-xs text-zinc-500">Saving to your session</p>
              ) : null}
            </>
          ) : finisherLs === "loading" ? (
            <>
              <p className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
                {sessionDone ? "Main work complete" : "Finisher offer"}
              </p>
              <p className="mt-3 text-center text-sm text-zinc-400">Preparing optional finisher…</p>
            </>
          ) : (
            <>
          <p className="text-center text-xs font-medium uppercase tracking-wider text-zinc-500">
            {sessionDone ? "Main work complete" : "Mostly wrapped"}
          </p>
          <p className="mt-3 text-center text-xl font-semibold text-white">Add abs finisher?</p>
          <p className="mt-3 max-w-sm text-center text-xs leading-relaxed text-zinc-500">
            You&apos;ve logged{" "}
            <span className="text-zinc-300">{Math.round(completionFraction * 100)}%</span> of planned
            sets{sessionDone ? "" : ` (we usually offer this after ${Math.round(ABS_PROMPT_MIN_COMPLETION * 100)}%)`}.
            If you tapped <span className="text-zinc-400">End</span> before finishing here, you skip this
            step.
          </p>
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
            {!sessionDone ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => setAbsOfferDeferred(true)}
                className={cn(
                  "rounded-2xl border border-zinc-500 py-4 text-base font-semibold text-zinc-200",
                  "touch-manipulation active:bg-zinc-800 disabled:opacity-50",
                )}
              >
                Later — keep lifting
              </button>
            ) : null}
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
              {sessionDone ? "No thanks — end session" : "No abs this session"}
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
                        await swapExercise(we.id, ex.id, await resolveProfile());
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
                    await attachExerciseToWorkoutExercise(we.id, pickId, await resolveProfile());
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
