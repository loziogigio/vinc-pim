"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Coins } from "lucide-react";

const TABS = [
  { href: "/admin/payments", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/payments/commissions", label: "Commissioni", icon: Coins },
];

export default function AdminPaymentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <div className="border-b border-[#ebe9f1] bg-white px-6">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-bold text-[#5e5873] py-4">
            Payments Admin
          </h1>
          <nav className="flex gap-1">
            {TABS.map((tab) => {
              const isActive =
                tab.href === "/admin/payments"
                  ? pathname === "/admin/payments"
                  : pathname?.startsWith(tab.href);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    isActive
                      ? "border-[#009688] text-[#009688]"
                      : "border-transparent text-muted-foreground hover:text-[#5e5873]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
