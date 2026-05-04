"use client";

import { cn } from "@/lib/cn";
import {
  getTrainingProfileAction,
  upsertTrainingProfileAction,
} from "@/app/actions/training-profile";
import {
  getTrainingProfileFromStorage,
  isValidTrainingProfile,
  saveTrainingProfileToStorage,
} from "@/lib/training-profile-storage";
import type { TrainingGoal, TrainingProfile } from "@/lib/types";
import { ProgressPhotosSection } from "@/components/ProgressPhotosSection";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const GOALS: { value: TrainingGoal; label: string; sub: string }[] = [
  { value: "bulk", label: "Build muscle", sub: "Hypertrophy / surplus-style bias" },
  { value: "cut", label: "Lose weight", sub: "Fat loss, keep strength" },
  { value: "maintain", label: "Maintain", sub: "Stay consistent" },
  { value: "recomp", label: "Recomp", sub: "Slow fat loss + muscle" },
  { value: "event", label: "Train for an event", sub: "Race, meet, sport…" },
];

export default function ProfilePage() {
  const router = useRouter();
  const [bodyWeightLbs, setBodyWeightLbs] = useState("");
  const [age, setAge] = useState("");
  const [goal, setGoal] = useState<TrainingGoal>("maintain");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [eventNote, setEventNote] = useState("");

  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const remote = await getTrainingProfileAction();
        const initial = remote ?? getTrainingProfileFromStorage();
        if (cancelled || !initial) return;
        queueMicrotask(() => {
          setBodyWeightLbs(String(initial.bodyWeightLbs));
          setAge(String(initial.age));
          setGoal(initial.goal);
          setDaysPerWeek(initial.daysPerWeek);
          setEventNote(initial.eventNote ?? "");
        });
      } catch {
        const local = getTrainingProfileFromStorage();
        if (cancelled || !local) return;
        queueMicrotask(() => {
          setBodyWeightLbs(String(local.bodyWeightLbs));
          setAge(String(local.age));
          setGoal(local.goal);
          setDaysPerWeek(local.daysPerWeek);
          setEventNote(local.eventNote ?? "");
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaveErr(null);
    const w = parseFloat(bodyWeightLbs);
    const a = parseInt(age, 10);
    const draft: TrainingProfile = {
      bodyWeightLbs: w,
      age: a,
      goal,
      daysPerWeek,
      eventNote: goal === "event" ? eventNote.trim() || undefined : undefined,
    };
    if (!isValidTrainingProfile(draft)) {
      return;
    }
    try {
      await upsertTrainingProfileAction(draft);
    } catch (e) {
      setSaveErr(e instanceof Error ? e.message : "Could not save to server.");
      return;
    }
    saveTrainingProfileToStorage(draft);
    router.push("/");
  };

  const canSave =
    Number.isFinite(parseFloat(bodyWeightLbs)) &&
    parseFloat(bodyWeightLbs) >= 95 &&
    Number.isFinite(parseInt(age, 10)) &&
    parseInt(age, 10) >= 14;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-8">
      <h1 className="text-2xl font-bold text-white">Your profile</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Used for starter weights when you don&apos;t have a prior log for a lift, and to steer AI
        workout style. Not medical advice.
      </p>

      <label className="mt-8 block text-sm text-zinc-400">
        Body weight (lbs)
        <input
          inputMode="decimal"
          type="number"
          value={bodyWeightLbs}
          onChange={(e) => setBodyWeightLbs(e.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white"
          placeholder="e.g. 185"
        />
      </label>

      <label className="mt-4 block text-sm text-zinc-400">
        Age
        <input
          inputMode="numeric"
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-lg text-white"
          placeholder="e.g. 32"
        />
      </label>

      <p className="mt-6 text-sm font-medium text-zinc-300">Primary goal</p>
      <div className="mt-3 flex flex-col gap-2">
        {GOALS.map((g) => (
          <button
            key={g.value}
            type="button"
            onClick={() => setGoal(g.value)}
            className={cn(
              "flex min-h-12 flex-col items-start rounded-xl px-4 py-3 text-left",
              goal === g.value ? "bg-emerald-900/40 ring-1 ring-emerald-600/60" : "bg-zinc-800",
            )}
          >
            <span className="font-medium text-white">{g.label}</span>
            <span className="text-xs text-zinc-500">{g.sub}</span>
          </button>
        ))}
      </div>

      {goal === "event" ? (
        <label className="mt-4 block text-sm text-zinc-400">
          Event / sport (optional)
          <input
            type="text"
            value={eventNote}
            onChange={(e) => setEventNote(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-white"
            placeholder="e.g. Half marathon in June"
          />
        </label>
      ) : null}

      <p className="mt-6 text-sm font-medium text-zinc-300">Strength days per week</p>
      <p className="mt-1 text-xs text-zinc-500">How many days you aim to train (for planning bias).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {([1, 2, 3, 4, 5, 6, 7] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDaysPerWeek(d)}
            className={cn(
              "min-h-12 min-w-[2.75rem] rounded-xl text-sm font-semibold touch-manipulation",
              daysPerWeek === d
                ? "bg-emerald-600 text-zinc-950"
                : "bg-zinc-800 text-zinc-200 active:bg-zinc-700",
            )}
          >
            {d}
          </button>
        ))}
      </div>

      <ProgressPhotosSection />

      <button
        type="button"
        disabled={!canSave}
        onClick={() => void save()}
        className={cn(
          "mt-8 w-full rounded-2xl bg-emerald-500 py-4 text-lg font-semibold text-zinc-950",
          "disabled:opacity-40",
        )}
      >
        Save & continue
      </button>
      {saveErr ? (
        <p className="mt-4 text-sm text-red-400" role="alert">
          {saveErr}
        </p>
      ) : null}
    </main>
  );
}
