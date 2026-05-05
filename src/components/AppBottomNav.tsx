"use client";

import { cn } from "@/lib/cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

function workoutRoutesActive(pathname: string): boolean {
  return pathname === "/pick" || pathname === "/workout" || pathname.startsWith("/workout/");
}

function homeActive(pathname: string): boolean {
  return pathname === "/";
}

function profileActive(pathname: string): boolean {
  return pathname === "/profile" || pathname.startsWith("/profile/");
}

function IconHome({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconDumbbell({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7v10M18 7v10M6 9a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2M18 9a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M8 12h8" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
    </svg>
  );
}

function IconProfile({ className }: { className?: string }) {
  return (
    <svg className={className} width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={12} cy={9} r={3.5} stroke="currentColor" strokeWidth={1.75} />
      <path
        d="M6.5 20.5v-1.2a4 4 0 0 1 4-4h3a4 4 0 0 1 4 4v1.2"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Fixed bottom tabs: Home, Workout (pick + session), Profile — LiftFlow theme. */
export function AppBottomNav() {
  const pathname = usePathname() ?? "";
  const home = homeActive(pathname);
  const workout = workoutRoutesActive(pathname);
  const profile = profileActive(pathname);

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-30 border-t border-zinc-800/90 bg-zinc-950/95 backdrop-blur-md",
        "pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1",
      )}
      aria-label="Main navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
        <Link
          href="/"
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold uppercase tracking-wide touch-manipulation active:opacity-80 sm:text-[11px]",
            home ? "text-emerald-400" : "text-zinc-500",
          )}
          aria-current={home ? "page" : undefined}
        >
          <IconHome className="shrink-0" />
          Home
        </Link>
        <Link
          href="/workout"
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold uppercase tracking-wide touch-manipulation active:opacity-80 sm:text-[11px]",
            workout ? "text-emerald-400" : "text-zinc-500",
          )}
          aria-current={workout ? "page" : undefined}
        >
          <IconDumbbell className="shrink-0" />
          Workout
        </Link>
        <Link
          href="/profile"
          className={cn(
            "flex min-h-[3.25rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px] font-semibold uppercase tracking-wide touch-manipulation active:opacity-80 sm:text-[11px]",
            profile ? "text-emerald-400" : "text-zinc-500",
          )}
          aria-current={profile ? "page" : undefined}
        >
          <IconProfile className="shrink-0" />
          Profile
        </Link>
      </div>
    </nav>
  );
}
