"use client";

import { AppSidebar, NavLink } from "@/components/navigation";
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Phone,
  RefreshCw,
  Settings,
} from "lucide-react";

export function PaymentsNavigation() {
  return (
    <AppSidebar title="Payments" icon={CreditCard}>
      <NavLink
        href="/b2b/payments"
        icon={LayoutDashboard}
        label="Dashboard"
        exactMatch
      />
      <NavLink
        href="/b2b/payments/transactions"
        icon={Receipt}
        label="Transazioni"
      />
      <NavLink
        href="/b2b/payments/gateways"
        icon={CreditCard}
        label="Gateway"
      />
      <NavLink
        href="/b2b/payments/moto"
        icon={Phone}
        label="Terminale MOTO"
      />
      <NavLink
        href="/b2b/payments/recurring"
        icon={RefreshCw}
        label="Ricorrenti"
      />
      <NavLink
        href="/b2b/payments/settings"
        icon={Settings}
        label="Impostazioni"
      />
    </AppSidebar>
  );
}
