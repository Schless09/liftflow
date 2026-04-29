"use client";

import type { WorkoutDetailDto } from "@/lib/db-types";
import { getWorkoutRepProgress } from "@/lib/workout-progress";
import { useMemo } from "react";

const VIEW = 52;
const STROKE = 4;
const R = (VIEW - STROKE) / 2;
const CX = VIEW / 2;
const CY = VIEW / 2;
const C = 2 * Math.PI * R;

type Props = { workout: WorkoutDetailDto };

/** Donut chart: rep-weighted completion (logged reps vs planned reps across the session). */
export function WorkoutProgressRing({ workout }: Props) {
  const { fraction, completedReps, totalReps } = useMemo(
    () => getWorkoutRepProgress(workout),
    [workout],
  );
  const pct = Math.round(fraction * 100);
  const offset = C * (1 - fraction);

  return (
    <div
      className="relative h-[52px] w-[52px] shrink-0"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Workout ${pct}% complete by reps`}
      title={`${completedReps} / ${totalReps} reps logged`}
    >
      <svg
        width={VIEW}
        height={VIEW}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden
      >
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          className="stroke-zinc-700/90"
          strokeWidth={STROKE}
        />
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          className="stroke-emerald-500 transition-[stroke-dashoffset] duration-500 ease-out"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-bold tabular-nums text-white">{pct}%</span>
      </div>
    </div>
  );
}
