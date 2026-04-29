"use client";

import {
  playRestCountdownTick,
  playRestEndChime,
  primeRestAlertAudio,
  restChimeMaybeVibrate,
} from "@/lib/rest-alert-audio";
import { cn } from "@/lib/cn";
import { useEffect, useRef, useState } from "react";

const REST_ADJUST_SEC = 15;
/** Matches server clamp in workout actions (never plan below 30s). */
const MIN_REST_SEC = 30;
const FINAL_BEEP_START_SEC = 5;

type Props = {
  active: boolean;
  initialSeconds: number;
  onComplete: () => void;
  onSkip: () => void;
};

export function RestTimer({ active, initialSeconds, onComplete, onSkip }: Props) {
  const [display, setDisplay] = useState(0);
  const leftRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const stop = () => {
    if (timerRef.current != null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startFrom = (seconds: number) => {
    stop();
    leftRef.current = Math.max(0, seconds);
    setDisplay(leftRef.current);
    if (leftRef.current <= 0) {
      playRestEndChime();
      restChimeMaybeVibrate([150, 80, 150]);
      onCompleteRef.current();
      return;
    }
    timerRef.current = setInterval(() => {
      leftRef.current -= 1;
      setDisplay(leftRef.current);
      if (leftRef.current <= 0) {
        stop();
        playRestEndChime();
        restChimeMaybeVibrate([150, 80, 150]);
        onCompleteRef.current();
        return;
      }
      if (leftRef.current <= FINAL_BEEP_START_SEC) {
        playRestCountdownTick();
        restChimeMaybeVibrate(45);
      }
    }, 1000);
  };

  useEffect(() => {
    if (!active) {
      stop();
      return;
    }
    startFrom(initialSeconds);
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset full timer when session rest params change
  }, [active, initialSeconds]);

  const add15 = () => {
    if (!active) return;
    primeRestAlertAudio();
    startFrom(leftRef.current + REST_ADJUST_SEC);
  };

  const sub15 = () => {
    if (!active || leftRef.current <= MIN_REST_SEC) return;
    primeRestAlertAudio();
    startFrom(Math.max(MIN_REST_SEC, leftRef.current - REST_ADJUST_SEC));
  };

  const skip = () => {
    primeRestAlertAudio();
    stop();
    onSkip();
  };

  if (!active) return null;

  const m = Math.floor(display / 60);
  const s = display % 60;
  const label = `${m}:${s.toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/85 px-6">
      <p className="text-sm uppercase tracking-wider text-zinc-400">Rest</p>
      <p
        className={cn(
          "mt-2 font-mono text-7xl font-bold tabular-nums text-emerald-400",
          display > 0 && display <= FINAL_BEEP_START_SEC && "rest-countdown-strobe",
        )}
      >
        {label}
      </p>
      <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={display <= MIN_REST_SEC}
            onClick={sub15}
            className={cn(
              "rounded-2xl bg-zinc-800 py-4 text-lg font-semibold text-white",
              "touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-40",
            )}
          >
            −15 sec
          </button>
          <button
            type="button"
            onClick={add15}
            className={cn(
              "rounded-2xl bg-zinc-800 py-4 text-lg font-semibold text-white",
              "touch-manipulation active:bg-zinc-700",
            )}
          >
            +15 sec
          </button>
        </div>
        <button
          type="button"
          onClick={skip}
          className={cn(
            "rounded-2xl border border-zinc-600 py-4 text-lg font-semibold text-zinc-200",
            "touch-manipulation active:bg-zinc-800",
          )}
        >
          Skip
        </button>
        <p className="mt-6 text-center text-xs leading-relaxed text-zinc-500">
          Beeps each second for the last 5s and when rest ends (requires tapping Log Set first). Keep
          Safari open — if you lock the phone or leave the tab, timers and audio may not run. Spotify
          may duck briefly for the beep.
        </p>
      </div>
    </div>
  );
}
