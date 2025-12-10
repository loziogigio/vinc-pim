"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LayoutDashboard,
  Settings,
  Package,
  Home,
  LogOut
} from "lucide-react";

const apps = [
  {
    name: "PIM",
    description: "Product management",
    href: "/b2b/pim",
    icon: Package,
    color: "bg-violet-500",
  },
  {
    name: "Home Builder",
    description: "Design your storefront",
    href: "/b2b/home-builder",
    icon: LayoutDashboard,
    color: "bg-blue-500",
  },
  {
    name: "Home Settings",
    description: "Configure homepage",
    href: "/b2b/home-settings",
    icon: Home,
    color: "bg-emerald-500",
  },
];

export function AppLauncher() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/b2b/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background to-muted p-6">
      <div className="w-full max-w-2xl">
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
            Welcome to VendereInCloud - CommerceSuite
          </h1>
          <p className="mt-2 text-muted-foreground">
            Select an application to get started
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 sm:grid-cols-5">
          {apps.map((app) => (
            <Link
              key={app.name}
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
                  {app.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {app.description}
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
              <p className="text-sm font-medium text-foreground">Logout</p>
              <p className="text-xs text-muted-foreground">Sign out</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
