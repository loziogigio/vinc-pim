"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";

export default function ShippedOrdersPage() {
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: `${tenantPrefix}/b2b/store/orders` },
          { label: "Shipped" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Shipped Orders</h1>
        <p className="text-sm text-muted-foreground">
          Orders in transit
        </p>
      </div>

      <OrdersStatusList
        status="shipped"
        statusLabel="Shipped"
        emptyMessage="Shipped orders will appear here"
      />
    </div>
  );
}
