"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  ListOrdered,
  BarChart3,
  Users,
  ListFilter,
  KeyRound,
  UserCog,
  Tags,
  Ticket,
} from "lucide-react";
import { cn } from "@/components/ui/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

// Base paths without tenant prefix
const orderPaths = [
  { labelKey: "nav.orders.overview", path: "/b2b/store/orders", icon: BarChart3 },
  { labelKey: "nav.orders.allOrders", path: "/b2b/store/orders/list", icon: ListOrdered },
  { labelKey: "nav.orders.coupons", path: "/b2b/store/coupons", icon: Ticket },
];

const customerPaths = [
  { labelKey: "nav.customers.overview", path: "/b2b/store/customers", icon: BarChart3 },
  { labelKey: "nav.customers.allCustomers", path: "/b2b/store/customers/list", icon: ListFilter },
  { labelKey: "nav.customers.customerTags", path: "/b2b/store/customers/tags", icon: Tags },
];

const portalUserPaths = [
  { labelKey: "nav.portalUsers.allPortalUsers", path: "/b2b/store/portal-users", icon: UserCog },
];

interface OrdersNavigationProps {
  tenantId?: string;
}

export function OrdersNavigation({ tenantId }: OrdersNavigationProps) {
  const pathname = usePathname();
  const { t } = useTranslation();

  // Build URL with tenant prefix
  const buildHref = (path: string) => {
    return tenantId ? `/${tenantId}${path}` : path;
  };

  const isActive = (path: string, section: string) => {
    let basePath: string;
    switch (section) {
      case "orders":
        basePath = "/b2b/store/orders";
        break;
      case "customers":
        basePath = "/b2b/store/customers";
        break;
      case "portal-users":
        basePath = "/b2b/store/portal-users";
        break;
      default:
        basePath = "/b2b/store/orders";
    }
    const href = buildHref(path);
    const baseHref = buildHref(basePath);

    if (href === baseHref) {
      return pathname === href;
    }
    return pathname === href || pathname?.startsWith(`${href}/`);
  };

  return (
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-border bg-card p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      {/* Orders Section */}
      <div className="mb-2 pb-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          {t("nav.orders.title")}
        </h2>
      </div>
      {orderPaths.map((item) => {
        const Icon = item.icon;
        const href = buildHref(item.path);
        const active = isActive(item.path, "orders");
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium transition",
              active
                ? "bg-primary/10 text-primary shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}

      {/* Customers Section */}
      <div className="mt-4 pt-3 border-t border-border mb-2 pb-3 border-b">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" />
          {t("nav.customers.title")}
        </h2>
      </div>
      {customerPaths.map((item) => {
        const Icon = item.icon;
        const href = buildHref(item.path);
        const active = isActive(item.path, "customers");
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium transition",
              active
                ? "bg-primary/10 text-primary shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}

      {/* Portal Users Section */}
      <div className="mt-4 pt-3 border-t border-border mb-2 pb-3 border-b">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wide flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          {t("nav.portalUsers.title")}
        </h2>
      </div>
      {portalUserPaths.map((item) => {
        const Icon = item.icon;
        const href = buildHref(item.path);
        const active = isActive(item.path, "portal-users");
        return (
          <Link
            key={item.path}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-[0.358rem] px-4 py-2.5 text-[0.875rem] font-medium transition",
              active
                ? "bg-primary/10 text-primary shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
