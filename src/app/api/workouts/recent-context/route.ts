import { getWorkoutRecencyContext } from "@/lib/workout-recency-context";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const ctx = await getWorkoutRecencyContext();
    return NextResponse.json(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
