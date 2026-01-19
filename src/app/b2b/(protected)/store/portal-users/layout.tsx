import type { ReactNode } from "react";
import { OrdersNavigation } from "@/components/orders/OrdersNavigation";
import { getB2BSession } from "@/lib/auth/b2b-session";

export default async function PortalUsersLayout({ children }: { children: ReactNode }) {
  const session = await getB2BSession();

  return (
    <div className="flex gap-6">
      <aside className="sticky top-6 self-start">
        <OrdersNavigation tenantId={session.tenantId} />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
