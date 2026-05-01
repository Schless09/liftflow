/**
 * Short rest-timer tones via Web Audio (works in Safari when the audio graph
 * is unlocked by a recent user gesture — we call prime from Save on the set log).
 */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  return audioCtx;
}

/** Max gain per tone (0–1). Higher = louder; keep below ~0.5 to reduce clipping when tones overlap. */
const COUNTDOWN_TICK_GAIN = 0.32;
const END_CHIME_PRIMARY_GAIN = 0.3;
const END_CHIME_SECOND_GAIN = 0.22;

function playTone(freq: number, durationSec: number, peakGain: number) {
  const ctx = getCtx();
  if (!ctx || ctx.state === "closed") return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = "sine";
  osc.frequency.value = freq;
  const t0 = ctx.currentTime;
  const dur = Math.max(0.05, durationSec);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peakGain, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.start(t0);
  osc.stop(t0 + dur + 0.04);
}

/** Call from a tap handler (e.g. Save) so iOS Safari allows playback. */
export function primeRestAlertAudio(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

/** Tick during final seconds of rest (one beep per second at 5…1). */
export function playRestCountdownTick(): void {
  primeRestAlertAudio();
  playTone(1046.5, 0.07, COUNTDOWN_TICK_GAIN);
}

/** Stronger two-tone “time’s up”. */
export function playRestEndChime(): void {
  primeRestAlertAudio();
  playTone(880, 0.16, END_CHIME_PRIMARY_GAIN);
  window.setTimeout(() => {
    playTone(1174.66, 0.2, END_CHIME_SECOND_GAIN);
  }, 110);
}

export function restChimeMaybeVibrate(pattern: number | number[] = 180): void {
  if (typeof navigator === "undefined") return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* iOS often no-ops */
  }
}
