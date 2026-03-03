"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";

export default function PendingOrdersPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: "/b2b/store/orders" },
          { label: "Pending" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Pending Orders</h1>
        <p className="text-sm text-muted-foreground">
          Orders awaiting confirmation
        </p>
      </div>

      <OrdersStatusList
        status="pending"
        statusLabel="Pending"
        emptyMessage="Pending orders will appear here"
      />
    </div>
  );
}
