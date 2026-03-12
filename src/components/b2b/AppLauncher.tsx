"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Settings,
  Package,
  Home,
  LogOut,
  Store
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { UILanguageSwitcher } from "./UILanguageSwitcher";

const apps = [
  {
    nameKey: "apps.pim.name",
    descriptionKey: "launcher.productManagement",
    href: "/b2b/pim",
    icon: Package,
    color: "bg-violet-500",
  },
  {
    nameKey: "apps.builder.name",
    descriptionKey: "launcher.designStorefront",
    href: "/b2b/home-builder",
    icon: LayoutDashboard,
    color: "bg-blue-500",
  },
  {
    nameKey: "apps.settings.name",
    descriptionKey: "launcher.configureHomepage",
    href: "/b2b/home-settings",
    icon: Home,
    color: "bg-emerald-500",
  },
  {
    nameKey: "apps.store-orders.name",
    descriptionKey: "launcher.ordersAndCustomers",
    href: "/b2b/store/orders",
    icon: Store,
    color: "bg-amber-500",
  },
];

export function AppLauncher() {
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogout = async () => {
    await fetch("/api/b2b/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <div className="w-full max-w-2xl">
        <div className="flex justify-end mb-4">
          <UILanguageSwitcher />
        </div>
        <div className="mb-20 text-center">
          <div className="mb-2 flex justify-center">
            <Image
              src="/vinc-bc.png"
              alt="VINC Logo"
              width={220}
              height={220}
              priority
            />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {t("launcher.welcome")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {t("launcher.selectApp")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
          {apps.map((app) => (
            <Link
              key={app.href}
              href={app.href}
              className="group flex flex-col items-center gap-3 rounded-2xl p-4 transition-all hover:bg-muted/50"
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl ${app.color} shadow-lg transition-transform group-hover:scale-110`}
              >
                <app.icon className="h-8 w-8 text-white" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {t(app.nameKey)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(app.descriptionKey)}
                </p>
              </div>
            </Link>
          ))}

          <button
            onClick={handleLogout}
            className="group flex flex-col items-center gap-3 rounded-2xl p-4 transition-all hover:bg-muted/50"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 shadow-lg transition-transform group-hover:scale-110">
              <LogOut className="h-8 w-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">{t("common.logout")}</p>
              <p className="text-xs text-muted-foreground">{t("common.signOut")}</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
