"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PermissionKey } from "@/lib/auth/permissions/catalog";
import type { PermissionsDTO } from "@/lib/auth/authorization";
import type { PriceAccess } from "@/lib/auth/permissions/price-access";

interface PermissionsContextValue {
  permissions: Set<PermissionKey>;
  entitledApps: string[];
  scope: PermissionsDTO["scope"];
  can: (permission: PermissionKey) => boolean;
  priceAccess: PriceAccess;
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null);

export function PermissionsProvider({
  value,
  children,
}: {
  value: PermissionsDTO;
  children: ReactNode;
}) {
  const ctx = useMemo<PermissionsContextValue>(() => {
    const set = new Set(value.permissions);
    return {
      permissions: set,
      entitledApps: value.entitledApps,
      scope: value.scope,
      can: (permission) => set.has(permission),
      priceAccess: value.priceAccess ?? "none",
    };
  }, [value]);
  return <PermissionsContext.Provider value={ctx}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext);
  if (!ctx) {
    // Fail-closed default when used outside a provider (e.g. legacy routes).
    return {
      permissions: new Set(),
      entitledApps: [],
      scope: { channels: "all", customers: "all", price_lists: "all" },
      can: () => false,
      priceAccess: "none",
    };
  }
  return ctx;
}

export function useCan(permission: PermissionKey): boolean {
  return usePermissions().can(permission);
}

export function usePriceAccess(): PriceAccess {
  return usePermissions().priceAccess;
}

export function Can({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return useCan(permission) ? <>{children}</> : <>{fallback}</>;
}
