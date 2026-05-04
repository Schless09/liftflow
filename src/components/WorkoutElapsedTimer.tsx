"use client";

import { cn } from "@/lib/cn";
import { useEffect, useMemo, useState } from "react";

function formatElapsed(totalSeconds: number): string {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Props = {
  startedAtIso: string;
  className?: string;
};

/** Live count-up from workout `created_at` (client clock). */
export function WorkoutElapsedTimer({ startedAtIso, className }: Props) {
  const startMs = useMemo(() => new Date(startedAtIso).getTime(), [startedAtIso]);
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(startMs)) return;
    const tick = () => {
      setElapsedSec(Math.max(0, (Date.now() - startMs) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  if (!Number.isFinite(startMs)) return null;

  const label = formatElapsed(elapsedSec);

  return (
    <p
      className={cn("text-xs tabular-nums text-zinc-300 sm:text-sm", className)}
      role="timer"
      aria-live="polite"
      aria-label={`Elapsed ${label}`}
    >
      <span className="text-zinc-500">Elapsed </span>
      <span>{label}</span>
    </p>
  );
}
