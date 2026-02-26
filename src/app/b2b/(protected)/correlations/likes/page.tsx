"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Heart, Users, Package, TrendingUp } from "lucide-react";
import { LIKE_TIME_PERIODS, LIKE_TIME_PERIOD_LABELS } from "@/lib/constants/like";
import type { LikeTimePeriod } from "@/lib/constants/like";
import type { LikeAnalyticsResponse, PopularProductResponse, TrendingProductResponse } from "@/lib/types/like";

export default function LikesDashboard() {
  const [period, setPeriod] = useState<LikeTimePeriod>("30d");
  const [analytics, setAnalytics] = useState<LikeAnalyticsResponse | null>(null);
  const [popular, setPopular] = useState<PopularProductResponse[]>([]);
  const [trending, setTrending] = useState<TrendingProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        const [analyticsRes, popularRes, trendingRes] = await Promise.all([
          fetch(`/api/b2b/likes/analytics?period=${period}`),
          fetch(`/api/b2b/likes/popular?limit=10&days=30`),
          fetch(`/api/b2b/likes/trending?period=${period}&limit=10`),
        ]);

        if (analyticsRes.ok) {
          const data = await analyticsRes.json();
          setAnalytics(data.data);
        }
        if (popularRes.ok) {
          const data = await popularRes.json();
          setPopular(data.data || []);
        }
        if (trendingRes.ok) {
          const data = await trendingRes.json();
          setTrending(data.data?.products || []);
        }
      } catch (error) {
        console.error("Likes dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [period]);

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading) {
    return renderEmptyState("Caricamento...", "Raccolta dati sui likes.");
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Correlazioni & Analytics", href: "/b2b/correlations" },
          { label: "Likes" },
        ]}
      />

      {/* Period Selector */}
      <div className="flex gap-2">
        {LIKE_TIME_PERIODS.map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`rounded-[0.358rem] px-3 py-1.5 text-[0.8rem] font-medium transition ${
              period === p
                ? "bg-[#009688] text-white shadow"
                : "bg-white text-[#6e6b7b] border border-[#ebe9f1] hover:border-[#009688] hover:text-[#009688]"
            }`}
          >
            {LIKE_TIME_PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={Heart}
          iconColor="#ea5455"
          iconBg="rgba(234,84,85,0.12)"
          label="Likes Totali"
          value={analytics?.total_likes || 0}
        />
        <StatsCard
          icon={Users}
          iconColor="#7367f0"
          iconBg="rgba(115,103,240,0.12)"
          label="Utenti Unici"
          value={analytics?.unique_users || 0}
        />
        <StatsCard
          icon={Package}
          iconColor="#28c76f"
          iconBg="rgba(40,199,111,0.12)"
          label="Prodotti Unici"
          value={analytics?.unique_products || 0}
        />
        <StatsCard
          icon={TrendingUp}
          iconColor="#ff9f43"
          iconBg="rgba(255,159,67,0.12)"
          label={`Likes (${LIKE_TIME_PERIOD_LABELS[period]})`}
          value={analytics?.likes_in_period || 0}
        />
      </div>

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Popular Products */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="border-b border-[#ebe9f1] p-4">
            <h3 className="text-[0.95rem] font-semibold text-[#5e5873]">Prodotti Popolari</h3>
          </div>
          <div className="p-4">
            {popular.length === 0 ? (
              <p className="text-[0.85rem] text-[#b9b9c3] text-center py-6">Nessun dato disponibile</p>
            ) : (
              <table className="w-full text-[0.85rem]">
                <thead>
                  <tr className="text-left text-[0.75rem] uppercase tracking-wide text-[#b9b9c3]">
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-right">Likes</th>
                    <th className="pb-2 text-right">Ultimo Like</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.map((p) => (
                    <tr key={p.sku} className="border-t border-[#ebe9f1]">
                      <td className="py-2 font-medium text-[#5e5873]">{p.sku}</td>
                      <td className="py-2 text-right text-[#6e6b7b]">{p.total_likes}</td>
                      <td className="py-2 text-right text-[#b9b9c3]">
                        {p.last_liked_at
                          ? new Date(p.last_liked_at).toLocaleDateString("it-IT", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Trending Products */}
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="border-b border-[#ebe9f1] p-4">
            <h3 className="text-[0.95rem] font-semibold text-[#5e5873]">Trending</h3>
          </div>
          <div className="p-4">
            {trending.length === 0 ? (
              <p className="text-[0.85rem] text-[#b9b9c3] text-center py-6">Nessun dato disponibile</p>
            ) : (
              <table className="w-full text-[0.85rem]">
                <thead>
                  <tr className="text-left text-[0.75rem] uppercase tracking-wide text-[#b9b9c3]">
                    <th className="pb-2">SKU</th>
                    <th className="pb-2 text-right">Likes Recenti</th>
                    <th className="pb-2 text-right">Velocit&agrave;</th>
                  </tr>
                </thead>
                <tbody>
                  {trending.map((t) => (
                    <tr key={t.sku} className="border-t border-[#ebe9f1]">
                      <td className="py-2 font-medium text-[#5e5873]">{t.sku}</td>
                      <td className="py-2 text-right text-[#6e6b7b]">{t.recent_likes}</td>
                      <td className="py-2 text-right text-[#b9b9c3]">{t.velocity_score}/d</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatsCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-5 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: iconBg }}
        >
          <Icon className="h-5 w-5" style={{ color: iconColor }} />
        </div>
        <div>
          <p className="text-[0.75rem] font-medium uppercase tracking-wide text-[#b9b9c3]">{label}</p>
          <p className="text-[1.5rem] font-bold text-[#5e5873]">{value.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
