"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Link2, Package, TrendingUp, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type CorrelationStats = {
  total_correlations: number;
  products_with_correlations: number;
  by_type: Record<string, number>;
  last_import?: {
    job_id: string;
    imported_at: string;
    rows_processed: number;
    success_count: number;
    error_count: number;
  };
};

export default function CorrelationsDashboard() {
  const [stats, setStats] = useState<CorrelationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/b2b/correlations/stats");
        if (!res.ok) {
          throw new Error("Failed to fetch correlation stats");
        }
        const data = await res.json();
        setStats(data.stats);
      } catch (error) {
        console.error("Correlations dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();
  }, []);

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading) {
    return renderEmptyState("Loading dashboard…", "Gathering correlation statistics.");
  }

  if (!stats) {
    return renderEmptyState("Unable to load dashboard", "Please refresh the page to try again.");
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Correlazioni & Analytics" }]} />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Correlations */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(0,150,136,0.12)]">
              <Link2 className="h-5 w-5 text-[#009688]" />
            </div>
            <div>
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#b9b9c3]">
                Total Correlations
              </p>
              <p className="text-[1.5rem] font-bold text-[#5e5873]">
                {stats.total_correlations.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Products with Correlations */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(115,103,240,0.12)]">
              <Package className="h-5 w-5 text-[#7367f0]" />
            </div>
            <div>
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#b9b9c3]">
                Products with Correlations
              </p>
              <p className="text-[1.5rem] font-bold text-[#5e5873]">
                {stats.products_with_correlations.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Related Products Type Count */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(40,199,111,0.12)]">
              <TrendingUp className="h-5 w-5 text-[#28c76f]" />
            </div>
            <div>
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#b9b9c3]">
                Articoli Correlati
              </p>
              <p className="text-[1.5rem] font-bold text-[#5e5873]">
                {(stats.by_type.related || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Last Import */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(255,159,67,0.12)]">
              <Upload className="h-5 w-5 text-[#ff9f43]" />
            </div>
            <div>
              <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#b9b9c3]">
                Last Import
              </p>
              <p className="text-[0.95rem] font-medium text-[#5e5873]">
                {stats.last_import
                  ? new Date(stats.last_import.imported_at).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "Nessun import"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* View Correlations */}
        <Link
          href={`${tenantPrefix}/b2b/correlations/related-products`}
          className="group rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] hover:border-[#009688] hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(0,150,136,0.12)] group-hover:bg-[rgba(0,150,136,0.2)] transition-colors">
              <Link2 className="h-6 w-6 text-[#009688]" />
            </div>
            <div>
              <h3 className="text-[1rem] font-semibold text-[#5e5873] group-hover:text-[#009688]">
                Articoli Correlati
              </h3>
              <p className="text-[0.85rem] text-[#b9b9c3]">
                Visualizza e gestisci le correlazioni tra prodotti
              </p>
            </div>
          </div>
        </Link>

        {/* Import Correlations */}
        <Link
          href={`${tenantPrefix}/b2b/pim/import`}
          className="group rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] hover:border-[#7367f0] hover:shadow-lg transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(115,103,240,0.12)] group-hover:bg-[rgba(115,103,240,0.2)] transition-colors">
              <Upload className="h-6 w-6 text-[#7367f0]" />
            </div>
            <div>
              <h3 className="text-[1rem] font-semibold text-[#5e5873] group-hover:text-[#7367f0]">
                Importa Correlazioni
              </h3>
              <p className="text-[0.85rem] text-[#b9b9c3]">
                Importa correlazioni da CSV (CORRE00F)
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Info Box */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <h3 className="text-[1rem] font-semibold text-[#5e5873] mb-3">
          Come funziona
        </h3>
        <div className="space-y-2 text-[0.875rem] text-[#6e6b7b]">
          <p>
            <strong>Articoli Correlati</strong> permette di definire relazioni tra prodotti per:
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Suggerimenti &quot;Potrebbero interessarti anche...&quot;</li>
            <li>Cross-selling nel carrello</li>
            <li>Prodotti complementari nelle schede prodotto</li>
          </ul>
          <p className="mt-3">
            Puoi importare le correlazioni dal sistema ERP (tabella CORRE00F) tramite CSV,
            oppure aggiungerle manualmente dalla lista prodotti.
          </p>
        </div>
      </div>
    </div>
  );
}
