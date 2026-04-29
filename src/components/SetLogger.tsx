"use client";

import { cn } from "@/lib/cn";
import { primeRestAlertAudio } from "@/lib/rest-alert-audio";
import { parseRepRange } from "@/lib/rep-range";
import { useState } from "react";

const WEIGHT_STEP = 5;
const WEIGHT_MAX = 2000;
const REP_MIN = 1;
const REP_MAX = 100;

type Props = {
  open: boolean;
  onClose: () => void;
  repRange: string;
  defaultWeight: number;
  onLog: (payload: { weight: number; reps: number }) => void;
};

export function SetLogger({ open, onClose, repRange, defaultWeight, onLog }: Props) {
  const { low, high } = parseRepRange(repRange);
  const mid = Math.round((low + high) / 2);

  const [weightVal, setWeightVal] = useState(() =>
    Math.max(0, Math.round(Number(defaultWeight) || 0)),
  );
  const [repsVal, setRepsVal] = useState(mid);

  if (!open) return null;

  const resetAndClose = () => {
    setWeightVal(Math.max(0, Math.round(Number(defaultWeight) || 0)));
    setRepsVal(mid);
    onClose();
  };

  const bumpWeight = (delta: number) => {
    setWeightVal((w) => Math.min(WEIGHT_MAX, Math.max(0, w + delta)));
  };

  const bumpReps = (delta: number) => {
    setRepsVal((r) => Math.min(REP_MAX, Math.max(REP_MIN, r + delta)));
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 sm:items-center" role="dialog">
      <div className="w-full max-w-lg rounded-t-3xl bg-zinc-900 p-6 shadow-xl sm:rounded-3xl">
        <p className="text-center text-lg font-medium text-white">Log this set</p>
        <p className="mt-2 text-center text-sm text-zinc-400">
          Tap − / + to match what you did (lbs and reps), then Save.
        </p>

        <p className="mt-6 text-sm font-medium text-zinc-400">Weight (lbs)</p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={weightVal <= 0}
            onClick={() => bumpWeight(-WEIGHT_STEP)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            −5
          </button>
          <div className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 py-4 text-center">
            <span className="text-3xl font-semibold tabular-nums text-white">{weightVal}</span>
            <span className="ml-1 text-lg font-normal text-zinc-500">lbs</span>
          </div>
          <button
            type="button"
            disabled={weightVal >= WEIGHT_MAX}
            onClick={() => bumpWeight(WEIGHT_STEP)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            +5
          </button>
        </div>

        <p className="mt-6 text-sm font-medium text-zinc-400">Reps</p>
        <p className="mt-0.5 text-xs text-zinc-600">
          Target range {low}–{high} (you can go outside if needed)
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={repsVal <= REP_MIN}
            onClick={() => bumpReps(-1)}
            className={cn(
              "flex min-h-14 min-w-[4.5rem] shrink-0 items-center justify-center rounded-2xl bg-zinc-800 text-base font-bold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35",
            )}
          >
            −1
          </button>
          <div className="min-w-0 flex-1 rounded-2xl border border-zinc-700 bg-zinc-950 py-4 text-center">
            <span className="text-3xl font-semibold tabular-nums text-white">{repsVal}</span>
            <span className="ml-1 text-lg font-normal text-zinc-500">reps</span>
          </div>
          <button
            type="button"
            disabled={repsVal >= REP_MAX}
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
          onClick={() => {
            primeRestAlertAudio();
            onLog({ weight: weightVal, reps: repsVal });
            resetAndClose();
          }}
        >
          Save
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
  );
}
