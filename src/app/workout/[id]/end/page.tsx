import { EndClient } from "./EndClient";

export default async function EndWorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EndClient workoutId={id} />;
}
