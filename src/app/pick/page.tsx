"use client";

import { createWorkoutFromPlan } from "@/app/actions/workout";
import { WorkoutCard } from "@/components/WorkoutCard";
import { titleCaseGroup } from "@/lib/muscle-format";
import { loadTrainingProfileMerged } from "@/lib/training-profile-load";
import type { Feeling, GeneratedWorkout, WorkoutDurationMinutes } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const DRAFT_KEY = "liftflow:draft";

type Draft = {
  feeling: Feeling;
  durationMinutes?: WorkoutDurationMinutes;
  focusMuscleGroups?: string[];
  workouts: GeneratedWorkout[];
};

function normalizeDuration(m: unknown): WorkoutDurationMinutes {
  if (m === 30 || m === 45 || m === 60) return m;
  return 45;
}

function readDraftFromStorage(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Draft;
  } catch {
    return null;
  }
}

export default function PickPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const d = readDraftFromStorage();
    if (!d) {
      router.replace("/workout/start");
      return;
    }
    queueMicrotask(() => {
      setDraft(d);
    });
  }, [router]);

  if (draft === undefined) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-zinc-400">Loading…</p>
      </div>
    );
  }

  if (draft === null) {
    return null;
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-8">
      <button
        type="button"
        onClick={() => router.back()}
        className="mb-4 flex min-h-11 items-center self-start text-sm text-zinc-500 touch-manipulation py-2"
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold text-white">Pick a workout</h1>
      <p className="mt-1 text-zinc-400">
        Three options for ~{normalizeDuration(draft.durationMinutes)} min — choose one to start.
      </p>
      {draft.focusMuscleGroups && draft.focusMuscleGroups.length > 0 ? (
        <p className="mt-2 text-sm text-emerald-400/90">
          Today&apos;s bias: {draft.focusMuscleGroups.map(titleCaseGroup).join(" · ")}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col gap-4">
        {draft.workouts.map((w, idx) => (
          <WorkoutCard
            key={`${w.name}-${idx}`}
            workout={w}
            disabled={pending}
            onSelect={() => {
              startTransition(async () => {
                const profile = await loadTrainingProfileMerged();
                await createWorkoutFromPlan(
                  draft.feeling,
                  normalizeDuration(draft.durationMinutes),
                  w,
                  profile,
                );
              });
            }}
          />
        ))}
      </div>
    </main>
  );
}
