"use client";

import {
  playRestCountdownTick,
  playRestEndChime,
  primeRestAlertAudio,
  restChimeMaybeVibrate,
} from "@/lib/rest-alert-audio";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/lib/use-escape-key";
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
  const [overlayVisible, setOverlayVisible] = useState(true);
  const leftRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const wasActiveRef = useRef(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (active) {
      if (!wasActiveRef.current) setOverlayVisible(true);
      wasActiveRef.current = true;
    } else {
      wasActiveRef.current = false;
    }
  }, [active]);

  useEscapeKey(overlayVisible && active, () => setOverlayVisible(false));

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

  const strobe = display > 0 && display <= FINAL_BEEP_START_SEC && "rest-countdown-strobe";

  const controls = (
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
      <p className="mt-4 text-center text-xs leading-relaxed text-zinc-500">
        Tap outside this card to keep resting with a small bar at the bottom. Beeps last 5s and at
        zero (tap Log Set first for sound). Keep Safari open while you train.
      </p>
    </div>
  );

  return (
    <>
      {overlayVisible ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-black/85"
            aria-label="Hide rest overlay; timer keeps running at the bottom"
            onClick={() => setOverlayVisible(false)}
          />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6">
            <div className="pointer-events-auto flex w-full max-w-sm flex-col items-center">
              <p className="text-sm uppercase tracking-wider text-zinc-400">Rest</p>
              <p
                className={cn(
                  "mt-2 font-mono text-7xl font-bold tabular-nums text-emerald-400",
                  strobe,
                )}
              >
                {label}
              </p>
              {controls}
            </div>
          </div>
        </div>
      ) : (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center gap-3 border-t border-zinc-700/90 bg-zinc-950/95 px-4 py-3 shadow-[0_-8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          role="status"
          aria-label={`Rest timer, ${label} left. Tap left to expand.`}
        >
          <button
            type="button"
            onClick={() => setOverlayVisible(true)}
            className="min-w-0 flex-1 touch-manipulation text-left active:opacity-80"
          >
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Rest</p>
            <p className={cn("font-mono text-2xl font-bold tabular-nums text-emerald-400", strobe)}>
              {label}
            </p>
            <p className="text-[11px] text-zinc-500">Tap to expand controls</p>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={display <= MIN_REST_SEC}
              onClick={sub15}
              className="rounded-xl bg-zinc-800 px-2.5 py-2 text-sm font-semibold text-white touch-manipulation active:bg-zinc-700 disabled:pointer-events-none disabled:opacity-35"
            >
              −15
            </button>
            <button
              type="button"
              onClick={add15}
              className="rounded-xl bg-zinc-800 px-2.5 py-2 text-sm font-semibold text-white touch-manipulation active:bg-zinc-700"
            >
              +15
            </button>
            <button
              type="button"
              onClick={skip}
              className="rounded-xl border border-zinc-600 px-2.5 py-2 text-sm font-medium text-zinc-200 touch-manipulation active:bg-zinc-800"
            >
              Skip
            </button>
          </div>
        </div>
      )}
    </>
  );
}
