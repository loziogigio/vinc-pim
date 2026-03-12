"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Plus,
  Search,
  Ticket,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Percent,
  Euro,
  Users,
  Calendar,
  Hash,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  COUPON_STATUS_LABELS,
  COUPON_DISCOUNT_TYPE_LABELS,
} from "@/lib/constants/coupon";
import type { ICoupon } from "@/lib/db/models/coupon";
import type { CouponStatus } from "@/lib/constants/coupon";
import { useTranslation } from "@/lib/i18n/useTranslation";

export default function CouponsListPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [coupons, setCoupons] = useState<ICoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CouponStatus | "">("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/b2b/coupons?${params}`);
      const data = await res.json();

      if (data.success) {
        setCoupons(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching coupons:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    fetchCoupons();
  }, [fetchCoupons]);

  const toggleStatus = async (coupon: ICoupon) => {
    const newStatus = coupon.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/b2b/coupons/${coupon.coupon_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchCoupons();
      }
    } catch (error) {
      console.error("Error toggling coupon:", error);
    }
  };

  const deleteCoupon = async (couponId: string) => {
    if (!confirm(t("pages.store.coupons.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/b2b/coupons/${couponId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchCoupons();
      } else {
        alert(data.error || t("pages.store.coupons.deleteError"));
      }
    } catch (error) {
      console.error("Error deleting coupon:", error);
    }
  };

  const formatDate = (d?: string | Date) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-600",
    expired: "bg-red-100 text-red-700",
    depleted: "bg-amber-100 text-amber-800",
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Store", href: "/b2b/store" },
          { label: t("pages.store.coupons.title") },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">{t("pages.store.coupons.title")}</h1>
          <p className="text-sm text-[#b9b9c3] mt-1">
            {total} {t("pages.store.coupons.totalSuffix")}
          </p>
        </div>
        <Link href={`${tenantPrefix}/b2b/store/coupons/new`}>
          <Button className="bg-[#009688] hover:bg-[#00796b] text-white">
            <Plus className="h-4 w-4 mr-2" />
            {t("pages.store.coupons.newCoupon")}
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#b9b9c3]" />
          <Input
            placeholder={t("pages.store.coupons.searchPlaceholder")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as CouponStatus | "");
            setPage(1);
          }}
          className="rounded-md border border-[#ebe9f1] px-3 py-2 text-sm text-[#6e6b7b] bg-white"
        >
          <option value="">{t("pages.store.coupons.allStatuses")}</option>
          {Object.entries(COUPON_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-[#b9b9c3]">
            {t("pages.store.coupons.loading")}
          </div>
        ) : coupons.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-[#b9b9c3]">
            <Ticket className="h-12 w-12 mb-3 opacity-40" />
            <p>{t("pages.store.coupons.noCouponsFound")}</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#fafafc]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.code")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.discount")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.validity")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.usage")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.options")}
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[#5e5873] uppercase">
                  {t("pages.store.coupons.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr
                  key={coupon.coupon_id}
                  className="border-b border-[#ebe9f1] hover:bg-[#fafafc] transition"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`${tenantPrefix}/b2b/store/coupons/${coupon.coupon_id}`}
                      className="font-mono font-semibold text-[#009688] hover:underline"
                    >
                      {coupon.code}
                    </Link>
                    {coupon.label && (
                      <p className="text-xs text-[#b9b9c3] mt-0.5">
                        {coupon.label}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-[#5e5873]">
                      {coupon.discount_type === "percentage" ? (
                        <>
                          <Percent className="h-3.5 w-3.5 text-[#b9b9c3]" />
                          {coupon.discount_value}%
                        </>
                      ) : (
                        <>
                          <Euro className="h-3.5 w-3.5 text-[#b9b9c3]" />
                          {coupon.discount_value.toFixed(2)}
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[coupon.status] || "bg-gray-100 text-gray-600"}`}
                    >
                      {COUPON_STATUS_LABELS[coupon.status] || coupon.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6e6b7b]">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-[#b9b9c3]" />
                      {formatDate(coupon.start_date)} -{" "}
                      {formatDate(coupon.end_date)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6e6b7b]">
                    <div className="flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5 text-[#b9b9c3]" />
                      {coupon.usage_count}
                      {coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {coupon.customer_emails && coupon.customer_emails.length > 0 && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                          <Users className="h-3 w-3" />
                          {coupon.customer_emails.length}
                        </span>
                      )}
                      {coupon.include_shipping && (
                        <span className="inline-flex rounded bg-purple-50 px-1.5 py-0.5 text-xs text-purple-700">
                          {t("pages.store.coupons.shipping")}
                        </span>
                      )}
                      {!coupon.is_cumulative && (
                        <span className="inline-flex rounded bg-orange-50 px-1.5 py-0.5 text-xs text-orange-700">
                          {t("pages.store.coupons.exclusive")}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => toggleStatus(coupon)}
                        className="p-1.5 rounded hover:bg-[#fafafc] transition"
                        title={
                          coupon.status === "active"
                            ? t("pages.store.coupons.deactivate")
                            : t("pages.store.coupons.activate")
                        }
                      >
                        {coupon.status === "active" ? (
                          <ToggleRight className="h-5 w-5 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-5 w-5 text-gray-400" />
                        )}
                      </button>
                      <button
                        onClick={() => deleteCoupon(coupon.coupon_id)}
                        className="p-1.5 rounded hover:bg-red-50 transition"
                        title={t("common.delete")}
                      >
                        <Trash2 className="h-4 w-4 text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#ebe9f1]">
            <span className="text-sm text-[#b9b9c3]">
              {t("common.page")} {page} {t("common.of")} {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("pages.store.coupons.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("pages.store.coupons.next")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
