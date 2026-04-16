"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Ship,
  CalendarCheck,
  Clock,
  Euro,
  Eye,
  ArrowRight,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { DepartureStatusBadge } from "@/components/bookings/DepartureStatusBadge";
import { BookingStatusBadge } from "@/components/bookings/BookingStatusBadge";
import { CapacityBar } from "@/components/bookings/CapacityBar";
import type { DepartureStatus, BookingStatus } from "@/lib/constants/booking";

interface Stats {
  departures: { total: number; by_status: Record<string, number> };
  bookings: { total: number; by_status: Record<string, number> };
  revenue: { confirmed_total: number; currency: string };
  pending_count: number;
  upcoming_count: number;
}

interface DepartureRow {
  departure_id: string;
  label: string;
  status: DepartureStatus;
  starts_at: string;
  resources: Array<{ total_capacity: number; available: number; held: number; booked: number }>;
}

interface BookingRow {
  booking_id: string;
  departure_label: string;
  customer_id: string;
  total_price: number;
  status: BookingStatus;
  created_at: string;
}

const currencyFormat = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" });

export default function BookingsOverviewPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [stats, setStats] = useState<Stats | null>(null);
  const [upcomingDeps, setUpcomingDeps] = useState<DepartureRow[]>([]);
  const [recentBookings, setRecentBookings] = useState<BookingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      try {
        const [statsRes, depsRes, bookRes] = await Promise.all([
          fetch("/api/b2b/bookings/stats"),
          fetch("/api/b2b/departures?status=active&limit=5"),
          fetch("/api/b2b/bookings?limit=5"),
        ]);

        if (!cancelled) {
          if (statsRes.ok) {
            const data = await statsRes.json();
            setStats(data.stats || null);
          }
          if (depsRes.ok) {
            const data = await depsRes.json();
            setUpcomingDeps(data.data?.departures || []);
          }
          if (bookRes.ok) {
            const data = await bookRes.json();
            setRecentBookings(data.data?.bookings || []);
          }
        }
      } catch (error) {
        console.error("Error fetching dashboard:", error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const statCards = [
    {
      label: t("pages.bookings.overview.totalDepartures"),
      value: stats?.departures.total ?? 0,
      sub: `${stats?.upcoming_count ?? 0} upcoming`,
      icon: Ship,
      color: "bg-teal-50",
      iconColor: "text-teal-600",
    },
    {
      label: t("pages.bookings.overview.activeBookings"),
      value: (stats?.bookings.by_status?.confirmed ?? 0) + (stats?.bookings.by_status?.held ?? 0),
      sub: `${stats?.bookings.total ?? 0} total`,
      icon: CalendarCheck,
      color: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: t("pages.bookings.overview.pendingBookings"),
      value: stats?.pending_count ?? 0,
      icon: Clock,
      color: "bg-amber-50",
      iconColor: "text-amber-600",
    },
    {
      label: t("pages.bookings.overview.revenue"),
      value: currencyFormat.format(stats?.revenue.confirmed_total ?? 0),
      icon: Euro,
      color: "bg-emerald-50",
      iconColor: "text-emerald-600",
      isString: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">{t("pages.bookings.overview.title")}</h1>
        <p className="text-[#b9b9c3] mt-1">{t("pages.bookings.overview.subtitle")}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-lg ${card.color}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#5e5873]">
                    {isLoading ? "—" : card.isString ? card.value : card.value}
                  </p>
                  <p className="text-xs text-[#b9b9c3]">{card.label}</p>
                  {card.sub && <p className="text-[10px] text-[#d5d5dc]">{card.sub}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming departures */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe9f1]">
            <h3 className="text-sm font-semibold text-[#5e5873]">{t("pages.bookings.overview.upcomingDepartures")}</h3>
            <Link href={`${tenantPrefix}/b2b/bookings/departures`} className="text-xs text-[#009688] hover:underline flex items-center gap-1">
              {t("pages.bookings.overview.viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {upcomingDeps.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#b9b9c3]">{t("pages.bookings.overview.noDepartures")}</p>
          ) : (
            <div className="divide-y divide-[#ebe9f1]">
              {upcomingDeps.map((dep) => {
                const totalCap = dep.resources.reduce((s, r) => s + r.total_capacity, 0);
                const booked = dep.resources.reduce((s, r) => s + r.booked, 0);
                const held = dep.resources.reduce((s, r) => s + r.held, 0);
                const available = dep.resources.reduce((s, r) => s + r.available, 0);
                return (
                  <Link key={dep.departure_id} href={`${tenantPrefix}/b2b/bookings/departures/${dep.departure_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafc] transition">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#5e5873] truncate">{dep.label}</div>
                      <div className="text-xs text-[#b9b9c3]">{dateFormat.format(new Date(dep.starts_at))}</div>
                    </div>
                    <div className="w-24">
                      <CapacityBar total={totalCap} available={available} held={held} booked={booked} />
                    </div>
                    <DepartureStatusBadge status={dep.status} />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe9f1]">
            <h3 className="text-sm font-semibold text-[#5e5873]">{t("pages.bookings.overview.recentBookings")}</h3>
            <Link href={`${tenantPrefix}/b2b/bookings/reservations`} className="text-xs text-[#009688] hover:underline flex items-center gap-1">
              {t("pages.bookings.overview.viewAll")} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentBookings.length === 0 ? (
            <p className="p-6 text-center text-sm text-[#b9b9c3]">{t("pages.bookings.overview.noBookings")}</p>
          ) : (
            <div className="divide-y divide-[#ebe9f1]">
              {recentBookings.map((b) => (
                <Link key={b.booking_id} href={`${tenantPrefix}/b2b/bookings/reservations/${b.booking_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#fafafc] transition">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#5e5873] truncate">{b.departure_label}</div>
                    <div className="text-xs text-[#b9b9c3]">{b.customer_id}</div>
                  </div>
                  <span className="text-sm font-medium text-[#5e5873]">{currencyFormat.format(b.total_price)}</span>
                  <BookingStatusBadge status={b.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
