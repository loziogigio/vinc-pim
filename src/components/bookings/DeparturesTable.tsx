"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eye, ChevronLeft, ChevronRight } from "lucide-react";
import { DepartureStatusBadge } from "./DepartureStatusBadge";
import { CapacityBar } from "./CapacityBar";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DepartureStatus } from "@/lib/constants/booking";

interface DepartureResource {
  resource_id: string;
  resource_type: string;
  child_entity_code: string;
  total_capacity: number;
  available: number;
  held: number;
  booked: number;
}

interface DepartureRow {
  departure_id: string;
  label: string;
  product_entity_code: string;
  status: DepartureStatus;
  starts_at: string;
  ends_at?: string;
  resources: DepartureResource[];
}

interface DeparturesTableProps {
  departures: DepartureRow[];
  total: number;
  page: number;
  limit: number;
  onPageChange: (page: number) => void;
  isLoading: boolean;
}

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function DeparturesTable({
  departures,
  total,
  page,
  limit,
  onPageChange,
  isLoading,
}: DeparturesTableProps) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const totalPages = Math.ceil(total / limit);

  function aggregateCapacity(resources: DepartureResource[]) {
    let totalCap = 0, available = 0, held = 0, booked = 0;
    for (const r of resources) {
      totalCap += r.total_capacity;
      available += r.available;
      held += r.held;
      booked += r.booked;
    }
    return { total: totalCap, available, held, booked };
  }

  if (isLoading) {
    return (
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-12 text-center">
        <div className="animate-pulse text-[#b9b9c3]">{t("common.loading") || "Loading..."}</div>
      </div>
    );
  }

  if (departures.length === 0) {
    return (
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-12 text-center">
        <p className="text-[#5e5873] font-medium">{t("pages.bookings.departures.noResults")}</p>
        <p className="text-sm text-[#b9b9c3] mt-1">{t("pages.bookings.departures.noResultsDesc")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[#ebe9f1] bg-[#fafafc]">
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">
              {t("pages.bookings.departures.label")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">
              {t("pages.bookings.departures.startsAt")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide">
              {t("pages.bookings.departures.status")}
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase tracking-wide w-48">
              {t("pages.bookings.departures.capacity")}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-[#5e5873] uppercase tracking-wide">
              {t("pages.bookings.departures.actions")}
            </th>
          </tr>
        </thead>
        <tbody>
          {departures.map((dep) => {
            const cap = aggregateCapacity(dep.resources);
            return (
              <tr key={dep.departure_id} className="border-b border-[#ebe9f1] last:border-0 hover:bg-[#fafafc] transition">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-[#5e5873]">{dep.label}</div>
                  <div className="text-xs text-[#b9b9c3]">{dep.product_entity_code}</div>
                </td>
                <td className="px-4 py-3 text-sm text-[#6e6b7b]">
                  {dateFormat.format(new Date(dep.starts_at))}
                </td>
                <td className="px-4 py-3">
                  <DepartureStatusBadge status={dep.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <CapacityBar {...cap} />
                    </div>
                    <span className="text-xs text-[#b9b9c3] whitespace-nowrap">
                      {cap.booked + cap.held}/{cap.total}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`${tenantPrefix}/b2b/bookings/departures/${dep.departure_id}`}
                    className="inline-flex items-center gap-1 rounded-[0.358rem] px-2.5 py-1.5 text-xs font-medium text-[#009688] hover:bg-[rgba(0,150,136,0.08)] transition"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    {t("pages.bookings.departures.view")}
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-[#ebe9f1] px-4 py-3">
          <span className="text-xs text-[#b9b9c3]">
            {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} / {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-[#5e5873]">{page}/{totalPages}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1.5 rounded-[0.358rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
