"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";

export default function ActiveCartsPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: "/b2b/store/orders" },
          { label: "Active Carts" },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">Active Carts</h1>
        <p className="text-sm text-muted-foreground">
          Draft orders in progress
        </p>
      </div>

      <OrdersStatusList
        status="draft"
        statusLabel="Active Cart"
        emptyMessage="Active carts (draft orders) will appear here"
      />
    </div>
  );
}
