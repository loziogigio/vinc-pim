import type { ReactNode } from "react";
import { CorrelationsNavigation } from "@/components/correlations/CorrelationsNavigation";

export default function CorrelationsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-6">
      <aside className="sticky top-6 self-start">
        <CorrelationsNavigation />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
