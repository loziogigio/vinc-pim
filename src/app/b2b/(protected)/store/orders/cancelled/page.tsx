"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";

export default function CancelledOrdersPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: "/b2b/store/orders" },
          { label: "Cancelled" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Cancelled Orders</h1>
        <p className="text-sm text-muted-foreground">
          Orders that have been cancelled
        </p>
      </div>

      <OrdersStatusList
        status="cancelled"
        statusLabel="Cancelled"
        emptyMessage="Cancelled orders will appear here"
      />
    </div>
  );
}
