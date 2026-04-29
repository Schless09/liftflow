"use client";

import { cn } from "@/lib/cn";
import { summarizeRecentForPrompt, titleCaseGroup } from "@/lib/muscle-format";
import { getTrainingProfileFromStorage } from "@/lib/training-profile-storage";
import type { Feeling, GeneratedPlanResponse, WorkoutDurationMinutes, WorkoutRecencyContext } from "@/lib/types";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const DRAFT_KEY = "liftflow:draft";

type Step = "feeling" | "duration" | "context";

export function HomeClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("feeling");
  const [feeling, setFeeling] = useState<Feeling | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<WorkoutDurationMinutes | null>(null);
  const [context, setContext] = useState<WorkoutRecencyContext | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [generateBusy, setGenerateBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadContextAndAdvance = async (m: WorkoutDurationMinutes) => {
    setErr(null);
    setDurationMinutes(m);
    setStep("context");
    setContext(null);
    setContextLoading(true);
    try {
      const res = await fetch("/api/workouts/recent-context");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load recent workouts");
      setContext(json as WorkoutRecencyContext);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setStep("duration");
      setDurationMinutes(null);
    } finally {
      setContextLoading(false);
    }
  };

  const generatePlans = async (generationMode: "rotation" | "balanced") => {
    if (!feeling || !durationMinutes || !context) return;
    setErr(null);
    setGenerateBusy(true);
    try {
      const recentMuscleSummary = summarizeRecentForPrompt(context.recent);
      const res = await fetch("/api/workouts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feeling,
          durationMinutes,
          focusMuscleGroups: context.suggestedFocus,
          recentMuscleSummary,
          generationMode,
          trainingProfile: getTrainingProfileFromStorage(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate workouts");
      const plan = json as GeneratedPlanResponse;
      sessionStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          feeling,
          durationMinutes,
          focusMuscleGroups: context.suggestedFocus,
          generationMode,
          workouts: plan.workouts,
        }),
      );
      router.push("/pick");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGenerateBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 pb-12 pt-10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium uppercase tracking-widest text-emerald-500">LiftFlow</p>
        <Link
          href="/profile"
          className="text-sm font-medium text-zinc-400 underline decoration-zinc-600 underline-offset-4 hover:text-zinc-300"
        >
          Profile
        </Link>
      </div>

      {step === "feeling" ? (
        <>
          <h1 className="mt-2 text-3xl font-bold text-white">How are you feeling today?</h1>
          <p className="mt-2 text-zinc-400">Tap one, then choose how long you have.</p>
          {!getTrainingProfileFromStorage() ? (
            <p className="mt-3 text-sm text-amber-200/80">
              <Link href="/profile" className="font-medium underline underline-offset-2">
                Set your profile
              </Link>{" "}
              (weight, age, goal) for smarter starting weights.
            </p>
          ) : null}

          <div className="mt-10 flex flex-col gap-4">
            {(
              [
                { k: "strong" as const, label: "Strong", sub: "Ready to push" },
                { k: "meh" as const, label: "Meh", sub: "Steady state" },
                { k: "tired" as const, label: "Tired", sub: "Dial it back" },
              ] as const
            ).map(({ k, label, sub }) => (
              <button
                key={k}
                type="button"
                disabled={contextLoading || generateBusy}
                onClick={() => {
                  setFeeling(k);
                  setStep("duration");
                }}
                className={cn(
                  "flex min-h-14 flex-col items-start rounded-2xl bg-zinc-800 px-5 py-4 text-left",
                  "touch-manipulation active:scale-[0.99] active:bg-zinc-700 disabled:opacity-50",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/80",
                )}
              >
                <span className="text-lg font-semibold text-white">{label}</span>
                <span className="text-sm text-zinc-400">{sub}</span>
              </button>
            ))}
          </div>
        </>
      ) : step === "duration" ? (
        <>
          <button
            type="button"
            disabled={contextLoading || generateBusy}
            onClick={() => {
              setStep("feeling");
              setFeeling(null);
            }}
            className="mt-2 self-start text-sm text-zinc-500 disabled:opacity-50"
          >
            ← Back
          </button>
          <h1 className="mt-4 text-3xl font-bold text-white">How long is your workout?</h1>
          <p className="mt-2 text-zinc-400">
            We&apos;ll size the three options to fit — not including full warm-up or cardio.
          </p>

          <div className="mt-10 flex flex-col gap-4">
            {(
              [
                { m: 30 as const, label: "30 min", sub: "Quick hit" },
                { m: 45 as const, label: "45 min", sub: "Standard session" },
                { m: 60 as const, label: "60 min", sub: "Full workout" },
              ] as const
            ).map(({ m, label, sub }) => (
              <button
                key={m}
                type="button"
                disabled={contextLoading || generateBusy}
                onClick={() => loadContextAndAdvance(m)}
                className={cn(
                  "flex min-h-14 flex-col items-start rounded-2xl bg-zinc-800 px-5 py-4 text-left",
                  "touch-manipulation active:scale-[0.99] active:bg-zinc-700 disabled:opacity-50",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400/80",
                )}
              >
                <span className="text-lg font-semibold text-white">
                  {contextLoading && durationMinutes === m ? "Loading…" : label}
                </span>
                <span className="text-sm text-zinc-400">{sub}</span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            type="button"
            disabled={contextLoading || generateBusy}
            onClick={() => {
              setStep("duration");
              setContext(null);
              setDurationMinutes(null);
            }}
            className="mt-2 self-start text-sm text-zinc-500 disabled:opacity-50"
          >
            ← Back
          </button>
          <h1 className="mt-4 text-3xl font-bold text-white">Where you&apos;ve been</h1>
          <p className="mt-2 text-zinc-400">Last two finished sessions — then today&apos;s bias.</p>

          {contextLoading ? (
            <p className="mt-10 text-zinc-500">Pulling your history…</p>
          ) : context ? (
            <>
              <div className="mt-8 space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                {context.recent.length === 0 ? (
                  <p className="text-sm text-zinc-400">
                    No completed workouts yet. Finish a session to build rotation memory.
                  </p>
                ) : (
                  context.recent.map((r, i) => (
                    <div key={r.id}>
                      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                        {i === 0 ? "Last workout" : "Before that"}
                      </p>
                      <p className="mt-1 text-base font-semibold text-white">{r.name}</p>
                      <p className="mt-1 text-sm text-zinc-400">
                        {r.muscleGroups.length > 0
                          ? `Muscle groups: ${r.muscleGroups.join(", ")}`
                          : "No mapped lifts logged (add exercises from the library next time)."}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-8 rounded-2xl border border-emerald-900/60 bg-emerald-950/25 p-5">
                <p className="text-xs font-medium uppercase tracking-wide text-emerald-500/90">
                  Today — emphasize
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  {context.suggestedFocus.map(titleCaseGroup).join(" · ")}
                </p>
                <p className="mt-2 text-sm text-zinc-400">
                  Three workout ideas will lean on these areas while your last sessions recover.
                </p>
              </div>

              <div className="mt-10 flex flex-col gap-3">
                <button
                  type="button"
                  disabled={generateBusy}
                  onClick={() => generatePlans("rotation")}
                  className={cn(
                    "w-full min-h-14 rounded-2xl bg-emerald-500 py-4 text-lg font-bold text-zinc-950",
                    "touch-manipulation active:bg-emerald-400 disabled:opacity-50",
                  )}
                >
                  {generateBusy ? "Generating…" : "Emphasize today's areas"}
                </button>
                <p className="px-1 text-center text-xs text-zinc-500">
                  Uses the green “Today — emphasize” muscle groups and your last two sessions.
                </p>
                <button
                  type="button"
                  disabled={generateBusy}
                  onClick={() => generatePlans("balanced")}
                  className={cn(
                    "w-full min-h-14 rounded-2xl border border-zinc-600 bg-zinc-900/40 py-4 text-lg font-semibold text-white",
                    "touch-manipulation active:bg-zinc-800 disabled:opacity-50",
                  )}
                >
                  Balanced full-body mix
                </button>
                <p className="px-1 text-center text-xs text-zinc-500">
                  Three well-rounded sessions; rotation bias is turned off (history is still context
                  for the model).
                </p>
              </div>
            </>
          ) : (
            <p className="mt-10 text-zinc-500">Something went wrong. Go back and try again.</p>
          )}
        </>
      )}

      {err ? <p className="mt-6 text-sm text-red-400">{err}</p> : null}
    </main>
  );
}
