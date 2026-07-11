"use client";

import { useLayoutStore } from "@/lib/stores/layoutStore";
import { contentWidthClass } from "@/lib/utils/layout";

export function MainContent({ children }: { children: React.ReactNode }) {
  const fullWidth = useLayoutStore((s) => s.fullWidth);

  // `vinc-login` (the design-system scope) gives every internal page the petrol
  // tokens, the Instrument Sans / Schibsted / JetBrains fonts and the .display /
  // .mono / .eyebrow / .card helpers; `suite-bg` adds the petrol-tinted backdrop.
  return (
    <div className="vinc-login suite-bg min-h-[calc(100vh-62px)]">
      <main className={`px-4 pb-10 pt-6 sm:px-6 lg:px-8 ${contentWidthClass(fullWidth)}`}>
        {children}
      </main>
    </div>
  );
}
