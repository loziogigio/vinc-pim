"use client";

import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { OrdersStatusList } from "@/components/orders/OrdersStatusList";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function CancelledOrdersPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: t("pages.store.orders.title"), href: "/b2b/store/orders" },
          { label: t("pages.store.ordersCancelled.title") },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("pages.store.ordersCancelled.title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("pages.store.ordersCancelled.subtitle")}
        </p>
      </div>

      <OrdersStatusList
        status="cancelled"
        statusLabel={t("pages.store.ordersCancelled.statusLabel")}
        emptyMessage={t("pages.store.ordersCancelled.emptyMessage")}
      />
    </div>
  );
}
