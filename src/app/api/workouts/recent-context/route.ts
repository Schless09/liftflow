import { getWorkoutRecencyContext } from "@/lib/workout-recency-context";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const ctx = await getWorkoutRecencyContext();
    return NextResponse.json(ctx);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load context";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
