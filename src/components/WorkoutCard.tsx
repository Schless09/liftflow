"use client";

import type { GeneratedWorkout } from "@/lib/types";
import { cn } from "@/lib/cn";

type Props = {
  workout: GeneratedWorkout;
  onSelect: () => void;
  disabled?: boolean;
};

export function WorkoutCard({ workout, onSelect, disabled }: Props) {
  const preview = workout.exercises.slice(0, 4).map((e) => e.name);

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border border-zinc-700 bg-zinc-900/80 p-5 text-left transition active:scale-[0.99]",
        "min-h-[120px] touch-manipulation disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/80",
      )}
    >
      <h2 className="text-lg font-semibold text-white">{workout.name}</h2>
      <ul className="mt-3 space-y-1 text-sm text-zinc-400">
        {preview.map((name) => (
          <li key={name} className="truncate">
            · {name}
          </li>
        ))}
        {workout.exercises.length > 4 ? (
          <li className="text-zinc-500">+{workout.exercises.length - 4} more</li>
        ) : null}
      </ul>
    </button>
  );
}
