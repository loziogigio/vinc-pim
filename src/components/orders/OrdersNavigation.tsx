"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShoppingCart,
  ListOrdered,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  BarChart3,
  Users,
  Building2,
  User,
  Store,
  ListFilter,
  KeyRound,
  UserCog,
} from "lucide-react";
import { cn } from "@/components/ui/utils";

// Base paths without tenant prefix
const orderPaths = [
  { label: "Overview", path: "/b2b/store/orders", icon: BarChart3 },
  { label: "All Orders", path: "/b2b/store/orders/list", icon: ListOrdered },
  { label: "Active Carts", path: "/b2b/store/orders/carts", icon: ShoppingCart },
  { label: "Pending", path: "/b2b/store/orders/pending", icon: Clock },
  { label: "Confirmed", path: "/b2b/store/orders/confirmed", icon: CheckCircle },
  { label: "Shipped", path: "/b2b/store/orders/shipped", icon: Truck },
  { label: "Cancelled", path: "/b2b/store/orders/cancelled", icon: XCircle },
];

const customerPaths = [
  { label: "Overview", path: "/b2b/store/customers", icon: BarChart3 },
  { label: "All Customers", path: "/b2b/store/customers/list", icon: ListFilter },
  { label: "Business", path: "/b2b/store/customers/business", icon: Building2 },
  { label: "Private", path: "/b2b/store/customers/private", icon: User },
  { label: "Reseller", path: "/b2b/store/customers/reseller", icon: Store },
];

const portalUserPaths = [
  { label: "All Portal Users", path: "/b2b/store/portal-users", icon: UserCog },
];

interface OrdersNavigationProps {
  tenantId?: string;
}

export function OrdersNavigation({ tenantId }: OrdersNavigationProps) {
  const pathname = usePathname();

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
    <nav className="flex flex-col gap-1 rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] min-w-[220px]">
      {/* Orders Section */}
      <div className="mb-2 pb-3 border-b border-[#ebe9f1]">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide flex items-center gap-2">
          <ShoppingCart className="h-4 w-4" />
          Orders
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
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Customers Section */}
      <div className="mt-4 pt-3 border-t border-[#ebe9f1] mb-2 pb-3 border-b">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide flex items-center gap-2">
          <Users className="h-4 w-4" />
          Customers
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
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Portal Users Section */}
      <div className="mt-4 pt-3 border-t border-[#ebe9f1] mb-2 pb-3 border-b">
        <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide flex items-center gap-2">
          <KeyRound className="h-4 w-4" />
          Portal Users
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
                ? "bg-[rgba(0,150,136,0.12)] text-[#009688] shadow-[0_0_10px_1px_rgba(0,150,136,0.15)]"
                : "text-[#6e6b7b] hover:bg-[#fafafc] hover:text-[#009688]"
            )}
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
