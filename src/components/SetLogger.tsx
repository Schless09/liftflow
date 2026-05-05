"use client";

import { cn } from "@/lib/cn";
import { primeRestAlertAudio } from "@/lib/rest-alert-audio";
import { parseRepRange, repRangeIsTimeBased } from "@/lib/rep-range";
import { useEscapeKey } from "@/lib/use-escape-key";
import { useCallback, useEffect, useState } from "react";

const WEIGHT_STEP = 5;
const WEIGHT_MAX = 2000;
const REP_MIN = 1;
const REP_MAX = 100;

type Props = {
  open: boolean;
  onClose: () => void;
  repRange: string;
  defaultWeight: number;
  /** When set, initial reps use this instead of rep-range midpoint (e.g. editing a logged set). */
  initialRepsOverride?: number | null;
  sheetTitle?: string;
  saveButtonLabel?: string;
  onLog: (payload: { weight: number; reps: number }) => void;
};

function clampWeight(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(WEIGHT_MAX, Math.max(0, n));
}

/** One-decimal display for barbell / plate-friendly weights. */
function formatWeightDisplay(n: number): string {
  const c = clampWeight(n);
  const rounded = Math.round(c * 10) / 10;
  if (rounded === 0) return "0";
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function parseWeightInput(s: string): number {
  const t = s.replace(/,/g, ".").trim();
  if (t === "" || t === ".") return 0;
  const n = parseFloat(t);
  return clampWeight(n);
}

export function SetLogger({
  open,
  onClose,
  repRange,
  defaultWeight,
  initialRepsOverride,
  sheetTitle = "Log this set",
  saveButtonLabel = "Save",
  onLog,
}: Props) {
  const { low, high } = parseRepRange(repRange);
  const mid = Math.round((low + high) / 2);
  const timeBased = repRangeIsTimeBased(repRange);
  const repCap = timeBased ? 600 : REP_MAX;

  const clampRepsVal = useCallback((n: number) => {
    if (!Number.isFinite(n)) return REP_MIN;
    return Math.min(repCap, Math.max(REP_MIN, Math.round(n)));
  }, [repCap]);

  const formatRepsDisplay = (n: number) => String(clampRepsVal(n));

  const parseRepsInput = (s: string) => {
    const t = s.trim();
    if (t === "") return REP_MIN;
    const n = parseInt(t, 10);
    if (!Number.isFinite(n)) return REP_MIN;
    return clampRepsVal(n);
  };

  const [weightVal, setWeightVal] = useState(() => clampWeight(Number(defaultWeight) || 0));
  const [weightDraft, setWeightDraft] = useState<string | null>(null);
  const [repsVal, setRepsVal] = useState(mid);
  const [repsDraft, setRepsDraft] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    queueMicrotask(() => {
      setWeightVal(clampWeight(Number(defaultWeight) || 0));
      setWeightDraft(null);
      const r =
        initialRepsOverride != null && Number.isFinite(Number(initialRepsOverride))
          ? clampRepsVal(Number(initialRepsOverride))
          : mid;
      setRepsVal(r);
      setRepsDraft(null);
    });
  }, [open, defaultWeight, initialRepsOverride, mid, clampRepsVal, repRange]);

  const resetAndClose = useCallback(() => {
    setWeightVal(clampWeight(Number(defaultWeight) || 0));
    setWeightDraft(null);
    setRepsVal(mid);
    setRepsDraft(null);
    onClose();
  }, [defaultWeight, mid, onClose]);

  useEscapeKey(open, resetAndClose);

  if (!open) return null;

  const weightFromUi = () =>
    weightDraft !== null ? parseWeightInput(weightDraft) : weightVal;
  const repsFromUi = () => (repsDraft !== null ? parseRepsInput(repsDraft) : repsVal);

  const bumpWeight = (delta: number) => {
    const base = weightFromUi();
    const next = clampWeight(base + delta);
    setWeightVal(next);
    setWeightDraft(null);
  };

  const bumpReps = (delta: number) => {
    const base = repsFromUi();
    const next = clampRepsVal(base + delta);
    setRepsVal(next);
    setRepsDraft(null);
  };

  const save = () => {
    const weight = weightFromUi();
    const reps = repsFromUi();
    setWeightVal(weight);
    setRepsVal(reps);
    setWeightDraft(null);
    setRepsDraft(null);
    primeRestAlertAudio();
    onLog({ weight, reps });
    resetAndClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="set-logger-title"
    >
      <div className="flex max-h-[min(92dvh,100%)] w-full max-w-lg flex-col rounded-t-3xl bg-zinc-900 shadow-xl sm:max-h-[85vh] sm:rounded-3xl">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <h2 id="set-logger-title" className="text-center text-lg font-medium text-white">
          {sheetTitle}
        </h2>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Use − / + or tap a number to type (e.g. 17.5 lb), then Save.
        </p>

        <p className="mt-6 text-sm font-medium text-zinc-400">Weight (lbs)</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={weightFromUi() <= 0}
            onClick={() => bumpWeight(-WEIGHT_STEP)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            −5
          </button>
          <label className="flex min-h-14 min-w-0 flex-1 cursor-text items-center justify-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-2 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/60">
            <span className="sr-only">Weight in pounds</span>
            <input
              type="text"
              name="log-weight-lbs"
              inputMode="decimal"
              autoComplete="off"
              value={weightDraft ?? formatWeightDisplay(weightVal)}
              onFocus={() => setWeightDraft(formatWeightDisplay(weightFromUi()))}
              onChange={(e) => {
                const t = e.target.value.replace(/[^0-9.]/g, "");
                setWeightDraft(t);
              }}
              onBlur={() => {
                if (weightDraft === null) return;
                setWeightVal(parseWeightInput(weightDraft));
                setWeightDraft(null);
              }}
              className="w-full min-w-0 bg-transparent text-center text-3xl font-semibold tabular-nums text-white outline-none"
            />
            <span className="shrink-0 text-lg font-normal text-zinc-500">lbs</span>
          </label>
          <button
            type="button"
            disabled={weightFromUi() >= WEIGHT_MAX}
            onClick={() => bumpWeight(WEIGHT_STEP)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            +5
          </button>
        </div>

        <p className="mt-6 text-sm font-medium text-zinc-400">
          {timeBased ? "Time (seconds)" : "Reps"}
        </p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Target {low}–{high}
          {timeBased ? " sec" : " reps"} (you can go outside if needed)
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={repsFromUi() <= REP_MIN}
            onClick={() => bumpReps(-1)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            −1
          </button>
          <label className="flex min-h-14 min-w-0 flex-1 cursor-text items-center justify-center gap-1 rounded-2xl border border-zinc-700 bg-zinc-950 px-2 py-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/60">
            <span className="sr-only">{timeBased ? "Seconds held" : "Repetitions"}</span>
            <input
              type="text"
              name="log-reps"
              inputMode="numeric"
              autoComplete="off"
              value={repsDraft ?? formatRepsDisplay(repsVal)}
              onFocus={() => setRepsDraft(formatRepsDisplay(repsFromUi()))}
              onChange={(e) => {
                const t = e.target.value.replace(/\D/g, "");
                setRepsDraft(t);
              }}
              onBlur={() => {
                if (repsDraft === null) return;
                setRepsVal(parseRepsInput(repsDraft));
                setRepsDraft(null);
              }}
              className="w-full min-w-0 bg-transparent text-center text-3xl font-semibold tabular-nums text-white outline-none"
            />
            <span className="shrink-0 text-lg font-normal text-zinc-500">{timeBased ? "sec" : "reps"}</span>
          </label>
          <button
            type="button"
            disabled={repsFromUi() >= repCap}
            onClick={() => bumpReps(1)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            +1
          </button>
        </div>

        <button
          type="button"
          className={cn(
            "mt-8 w-full rounded-2xl bg-white py-4 text-lg font-semibold text-zinc-950",
            "touch-manipulation active:bg-zinc-200",
          )}
          onClick={save}
        >
          {saveButtonLabel}
        </button>
        <button
          type="button"
          className={cn(
            "mt-3 w-full rounded-2xl border border-zinc-600 py-3 text-base font-semibold text-zinc-300",
            "touch-manipulation active:bg-zinc-800",
          )}
          onClick={resetAndClose}
        >
          Cancel
        </button>
        </div>
      </div>
    </div>
  );
}
