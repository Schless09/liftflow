/** Bodyweight-friendly circuit names — must match `exercises.canonical_name` in OSS seed. */
export const ABS_FINISHER_5_MIN = [
  "Band Bicycle Crunch",
  "Crunch Floor",
  "Reverse Crunch",
  "Lying Leg Raise Flat Bench",
  "Dead Bug",
] as const;

export const ABS_FINISHER_8_MIN = [
  "Band Bicycle Crunch",
  "Crunch Floor",
  "Reverse Crunch",
  "Lying Leg Raise Flat Bench",
  "Dead Bug",
  "Russian Twist",
  "Oblique Crunches Floor",
  "Decline Sit-up",
] as const;

/** Between moves in the finisher (seconds). */
export const ABS_FINISHER_REST_SEC = 10;

/** Fast pace; one working set per move. */
export const ABS_FINISHER_REP_RANGE = "15-20";
