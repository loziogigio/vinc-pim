"use client";

import { useLayoutStore } from "@/lib/stores/layoutStore";

export function MainContent({ children }: { children: React.ReactNode }) {
  const fullWidth = useLayoutStore((s) => s.fullWidth);

  return (
    <main className={fullWidth ? "px-8 pb-10 pt-6" : "mx-auto max-w-[1600px] px-8 pb-10 pt-6"}>
      {children}
    </main>
  );
}
