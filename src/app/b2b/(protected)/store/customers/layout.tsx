import type { ReactNode } from "react";
import { OrdersNavigation } from "@/components/orders/OrdersNavigation";
import { getB2BSession } from "@/lib/auth/b2b-session";

export default async function CustomersLayout({ children }: { children: ReactNode }) {
  const session = await getB2BSession();

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="self-start lg:sticky lg:top-6">
        <OrdersNavigation tenantId={session.tenantId} />
      </aside>
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
