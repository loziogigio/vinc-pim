"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Phone,
  RefreshCw,
  Settings,
  Truck,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function PaymentsNavigation() {
  const { t } = useTranslation();

  return (
    <AppSidebar title={t("nav.payments.title")} icon={CreditCard}>
      <NavLink
        href="/b2b/payments"
        icon={LayoutDashboard}
        label={t("nav.payments.dashboard")}
        exactMatch
      />
      <NavLink
        href="/b2b/payments/transactions"
        icon={Receipt}
        label={t("nav.payments.transactions")}
      />
      <NavLink
        href="/b2b/payments/gateways"
        icon={CreditCard}
        label={t("nav.payments.gateways")}
      />
      <NavLink
        href="/b2b/payments/moto"
        icon={Phone}
        label={t("nav.payments.motoTerminal")}
      />
      <NavLink
        href="/b2b/payments/recurring"
        icon={RefreshCw}
        label={t("nav.payments.recurring")}
      />
      <NavLink
        href="/b2b/payments/shipping"
        icon={Truck}
        label={t("nav.payments.shipping")}
      />
      <NavLink
        href="/b2b/payments/settings"
        icon={Settings}
        label={t("nav.payments.settings")}
      />
    </AppSidebar>
  );
}
