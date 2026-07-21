"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, CreditCard, Pencil, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { getLocalizedString } from "@/lib/types/pim";
import type { ISubscriptionPlan } from "@/lib/types/subscription";

export default function SubscriptionPlansPage() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [plans, setPlans] = useState<ISubscriptionPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      const res = await fetch(`/api/b2b/subscription-plans?${params}`);
      const data = await res.json();
      if (data.success) {
        setPlans(data.items || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  async function handleDelete(planId: string) {
    if (!confirm(t("pages.store.subscriptions.deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/b2b/subscription-plans/${planId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchPlans();
      } else {
        alert(t("pages.store.subscriptions.deleteError"));
      }
    } catch {
      alert(t("pages.store.subscriptions.deleteError"));
    }
  }

  function priceLabel(plan: ISubscriptionPlan): string {
    if (!plan.billing_options?.length) return "—";
    return plan.billing_options
      .map((opt) => {
        const per =
          opt.interval === "year"
            ? t("pages.store.subscriptions.perYear")
            : t("pages.store.subscriptions.perMonth");
        return `${plan.currency} ${opt.base_price}${per}`;
      })
      .join(" · ");
  }

  function metricLabel(plan: ISubscriptionPlan): string {
    const m = plan.metrics?.[0];
    if (!m) return "—";
    return `${m.included_quantity} ${m.metric_key} (+${plan.currency} ${m.overage_unit_price})`;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CreditCard className="h-7 w-7 text-cyan-600" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("pages.store.subscriptions.title")}</h1>
            <p className="text-sm text-muted-foreground">
              {total} {t("pages.store.subscriptions.totalSuffix")} · {t("pages.store.subscriptions.subtitle")}
            </p>
          </div>
        </div>
        <Link href={`${tenantPrefix}/b2b/store/subscriptions/new`}>
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="h-4 w-4 mr-2" />
            {t("pages.store.subscriptions.newPlan")}
          </Button>
        </Link>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t("pages.store.subscriptions.searchPlaceholder")}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">{t("pages.store.subscriptions.allStatuses")}</option>
          <option value="active">{t("pages.store.subscriptions.active")}</option>
          <option value="archived">{t("pages.store.subscriptions.archived")}</option>
        </select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.code")}</th>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.name")}</th>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.channel")}</th>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.price")}</th>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.included")}</th>
              <th className="text-left px-4 py-2">{t("pages.store.subscriptions.status")}</th>
              <th className="text-right px-4 py-2">{t("pages.store.subscriptions.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">{t("pages.store.subscriptions.loading")}</td></tr>
            ) : plans.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">{t("pages.store.subscriptions.noPlansFound")}</td></tr>
            ) : (
              plans.map((plan) => (
                <tr key={plan.plan_id} className="border-t border-border">
                  <td className="px-4 py-2 font-mono">{plan.code}</td>
                  <td className="px-4 py-2">{getLocalizedString(plan.name)}</td>
                  <td className="px-4 py-2">{plan.channel}</td>
                  <td className="px-4 py-2">{priceLabel(plan)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{metricLabel(plan)}</td>
                  <td className="px-4 py-2">
                    <span className={plan.status === "active" ? "text-emerald-600" : "text-muted-foreground"}>
                      {plan.status === "active" ? t("pages.store.subscriptions.active") : t("pages.store.subscriptions.archived")}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`${tenantPrefix}/b2b/store/subscriptions/${plan.plan_id}`}>
                        <Button variant="outline" size="sm"><Pencil className="h-4 w-4" /></Button>
                      </Link>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(plan.plan_id)}>
                        <Trash2 className="h-4 w-4 text-rose-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t("pages.store.subscriptions.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("pages.store.subscriptions.pageOf", { page: String(page), totalPages: String(totalPages) })}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            {t("pages.store.subscriptions.next")}
          </Button>
        </div>
      )}
    </div>
  );
}
