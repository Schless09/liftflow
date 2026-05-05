import { ClerkUserHeader } from "@/components/ClerkUserHeader";
import type { ReactNode } from "react";

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ClerkUserHeader />
      {children}
    </>
  );
}
