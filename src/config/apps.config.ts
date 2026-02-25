/**
 * Centralized App Registry
 *
 * Single source of truth for all B2B applications.
 * Used by: AppLauncherDropdown, TenantAppLauncher, DashboardHeader
 */

import type { LucideIcon } from "lucide-react";
import {
  Home,
  Package,
  Link2,
  Store,
  Users,
  KeyRound,
  LayoutDashboard,
  Settings,
  Globe,
} from "lucide-react";

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string; // Tailwind bg class (e.g., "bg-violet-500")
  // Visibility flags
  showInLauncher: boolean;
  showInHeader: boolean;
  // Navigation
  hasNavigation: boolean;
}

/**
 * All B2B applications
 * Order determines display order in App Launcher
 */
export const APPS: AppConfig[] = [
  {
    id: "home",
    name: "Home",
    description: "Dashboard principale",
    href: "/b2b",
    icon: Home,
    color: "bg-[#009688]",
    showInLauncher: true,
    showInHeader: false,
    hasNavigation: false,
  },
  {
    id: "pim",
    name: "PIM",
    description: "Product Information Management",
    href: "/b2b/pim",
    icon: Package,
    color: "bg-violet-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "correlations",
    name: "Correlazioni",
    description: "Articoli correlati e analytics",
    href: "/b2b/correlations",
    icon: Link2,
    color: "bg-cyan-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "store-orders",
    name: "Store",
    description: "Gestione ordini",
    href: "/b2b/store/orders",
    icon: Store,
    color: "bg-amber-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "store-customers",
    name: "Customers",
    description: "Gestione clienti",
    href: "/b2b/store/customers",
    icon: Users,
    color: "bg-emerald-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "store-portal-users",
    name: "Portal Users",
    description: "Utenti portale B2B",
    href: "/b2b/store/portal-users",
    icon: KeyRound,
    color: "bg-indigo-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "builder",
    name: "Builder",
    description: "Home page builder",
    href: "/b2b/home-builder",
    icon: LayoutDashboard,
    color: "bg-blue-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: false,
  },
  {
    id: "b2c",
    name: "B2C",
    description: "Storefront web builders",
    href: "/b2b/b2c",
    icon: Globe,
    color: "bg-pink-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: true,
  },
  {
    id: "settings",
    name: "Settings",
    description: "Configurazione negozio",
    href: "/b2b/home-settings",
    icon: Settings,
    color: "bg-slate-500",
    showInLauncher: true,
    showInHeader: true,
    hasNavigation: false,
  },
];

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get app by ID
 */
export function getAppById(id: string): AppConfig | undefined {
  return APPS.find((app) => app.id === id);
}

/**
 * Get app matching the current pathname
 * Matches most specific path first (longer paths take priority)
 */
export function getAppByPath(pathname: string): AppConfig | undefined {
  // Remove tenant prefix if present (e.g., /tenant-id/b2b/pim -> /b2b/pim)
  const normalizedPath = pathname.replace(/^\/[^/]+(?=\/b2b)/, "");

  // Find matching apps and sort by path length (most specific first)
  const matches = APPS.filter(
    (app) =>
      normalizedPath === app.href || normalizedPath.startsWith(`${app.href}/`)
  ).sort((a, b) => b.href.length - a.href.length);

  return matches[0];
}

/**
 * Get apps to show in the App Launcher dropdown
 */
export function getLauncherApps(): AppConfig[] {
  return APPS.filter((app) => app.showInLauncher);
}

/**
 * Get apps that should trigger header section display
 */
export function getHeaderApps(): AppConfig[] {
  return APPS.filter((app) => app.showInHeader);
}

/**
 * Get current section info for DashboardHeader
 * Returns the app matching the current path, or Home as default
 */
export function getCurrentSection(pathname: string): {
  name: string;
  icon: LucideIcon;
  color: string;
} {
  const app = getAppByPath(pathname);

  if (app) {
    return {
      name: app.name,
      icon: app.icon,
      color: app.color,
    };
  }

  // Default to Dashboard/Home
  return {
    name: "Dashboard",
    icon: Home,
    color: "bg-[#009688]",
  };
}
