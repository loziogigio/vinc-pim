"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";

export default function ConfirmedOrdersPage() {
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: `${tenantPrefix}/b2b/store/orders` },
          { label: "Confirmed" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Confirmed Orders</h1>
        <p className="text-sm text-muted-foreground">
          Orders ready for shipping
        </p>
      </div>

      <OrdersStatusList
        status="confirmed"
        statusLabel="Confirmed"
        emptyMessage="Confirmed orders will appear here"
      />
    </div>
  );
}
