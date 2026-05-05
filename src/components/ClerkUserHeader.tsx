"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/** Account chrome — shown only under `/profile` (see `app/profile/layout.tsx`). */
export function ClerkUserHeader() {
  return (
    <header className="flex shrink-0 items-center justify-end gap-2 border-b border-zinc-800 px-4 py-3">
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
