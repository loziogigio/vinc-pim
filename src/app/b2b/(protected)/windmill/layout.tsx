import type { ReactNode } from "react";
import { WindmillNavigation } from "@/components/settings/WindmillNavigation";

export default function WindmillLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-6">
      <aside className="sticky top-6 self-start">
        <WindmillNavigation />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
