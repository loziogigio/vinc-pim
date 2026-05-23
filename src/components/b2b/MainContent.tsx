"use client";

import { useLayoutStore } from "@/lib/stores/layoutStore";

export function MainContent({ children }: { children: React.ReactNode }) {
  const fullWidth = useLayoutStore((s) => s.fullWidth);

  return (
    <main className={fullWidth ? "px-4 pb-10 pt-6 sm:px-6 lg:px-8" : "mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8"}>
      {children}
    </main>
  );
}
