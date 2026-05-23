import type { ReactNode } from "react";
import { PIMNavigation } from "@/components/pim/PIMNavigation";

export default function PIMLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="self-start lg:sticky lg:top-6">
        <PIMNavigation />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
