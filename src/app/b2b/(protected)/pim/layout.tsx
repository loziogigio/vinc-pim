import type { ReactNode } from "react";
import { PIMNavigation } from "@/components/pim/PIMNavigation";

export default function PIMLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-6">
      <aside className="sticky top-6 self-start">
        <PIMNavigation />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
