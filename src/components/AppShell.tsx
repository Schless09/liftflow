"use client";

import { cn } from "@/lib/cn";
import { useAuth } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppBottomNav } from "./AppBottomNav";

const NAV_INSET =
  "pb-[max(4.25rem,calc(4rem+env(safe-area-inset-bottom)))]";

/**
 * Adds bottom inset when the tab bar is visible so content is not covered.
 * Hidden on sign-in / sign-up and when signed out.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { isSignedIn } = useAuth();
  const pathname = usePathname() ?? "";
  const hideNav = pathname.startsWith("/sign-in") || pathname.startsWith("/sign-up");
  const showNav = Boolean(isSignedIn) && !hideNav;

  return (
    <>
      <div className={cn("flex min-h-0 flex-1 flex-col", showNav && NAV_INSET)}>
        {children}
      </div>
      {showNav ? <AppBottomNav /> : null}
    </>
  );
}
