"use client";

import { useEffect, useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BellRing, Bell, BellOff, Clock } from "lucide-react";
import { REMINDER_STATUS_LABELS } from "@/lib/constants/reminder";

type ReminderDashboardStats = {
  active: number;
  notified: number;
  expired: number;
  cancelled: number;
};

type MostWantedProduct = {
  sku: string;
  active_count: number;
  total_count: number;
};

export default function RemindersDashboard() {
  const [stats, setStats] = useState<ReminderDashboardStats | null>(null);
  const [mostWanted, setMostWanted] = useState<MostWantedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);
  const [expireResult, setExpireResult] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/b2b/reminders/user?limit=1");
        if (res.ok) {
          // We'll derive stats from summary once available
          // For now, initialize with zeros
          setStats({ active: 0, notified: 0, expired: 0, cancelled: 0 });
        }
      } catch (error) {
        console.error("Reminders dashboard fetch error:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, []);

  async function handleExpire() {
    setIsExpiring(true);
    setExpireResult(null);
    try {
      const res = await fetch("/api/b2b/reminders/expire", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setExpireResult(`${data.data.expired_count} reminders scaduti aggiornati`);
      }
    } catch (error) {
      console.error("Expire error:", error);
      setExpireResult("Errore durante l'operazione");
    } finally {
      setIsExpiring(false);
    }
  }

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading) {
    return renderEmptyState("Caricamento...", "Raccolta dati sui reminders.");
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Correlazioni & Analytics", href: "/b2b/correlations" },
          { label: "Reminders" },
        ]}
      />

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          icon={BellRing}
          iconColor="#28c76f"
          iconBg="rgba(40,199,111,0.12)"
          label={REMINDER_STATUS_LABELS.active}
          value={stats?.active || 0}
        />
        <StatsCard
          icon={Bell}
          iconColor="#7367f0"
          iconBg="rgba(115,103,240,0.12)"
          label={REMINDER_STATUS_LABELS.notified}
          value={stats?.notified || 0}
        />
        <StatsCard
          icon={Clock}
          iconColor="#ff9f43"
          iconBg="rgba(255,159,67,0.12)"
          label={REMINDER_STATUS_LABELS.expired}
          value={stats?.expired || 0}
        />
        <StatsCard
          icon={BellOff}
          iconColor="#ea5455"
          iconBg="rgba(234,84,85,0.12)"
          label={REMINDER_STATUS_LABELS.cancelled}
          value={stats?.cancelled || 0}
        />
      </div>

      {/* Actions */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <h3 className="text-[0.95rem] font-semibold text-[#5e5873] mb-4">Azioni</h3>
        <div className="flex items-center gap-4">
          <button
            onClick={handleExpire}
            disabled={isExpiring}
            className="rounded-[0.358rem] bg-[#ff9f43] px-4 py-2 text-[0.85rem] font-medium text-white transition hover:bg-[#e08e38] disabled:opacity-50"
          >
            {isExpiring ? "In corso..." : "Scadi Reminders Vecchi"}
          </button>
          {expireResult && (
            <span className="text-[0.85rem] text-[#6e6b7b]">{expireResult}</span>
          )}
        </div>
      </div>

      {/* Most Wanted Products */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <div className="border-b border-[#ebe9f1] p-4">
          <h3 className="text-[0.95rem] font-semibold text-[#5e5873]">Prodotti Pi&ugrave; Richiesti</h3>
          <p className="text-[0.8rem] text-[#b9b9c3]">Prodotti con il maggior numero di reminders attivi</p>
        </div>
        <div className="p-4">
          {mostWanted.length === 0 ? (
            <p className="text-[0.85rem] text-[#b9b9c3] text-center py-6">
              Nessun dato disponibile. I dati appariranno quando gli utenti creeranno reminders.
            </p>
          ) : (
            <table className="w-full text-[0.85rem]">
              <thead>
                <tr className="text-left text-[0.75rem] uppercase tracking-wide text-[#b9b9c3]">
                  <th className="pb-2">SKU</th>
                  <th className="pb-2 text-right">Reminders Attivi</th>
                  <th className="pb-2 text-right">Totale</th>
                </tr>
              </thead>
              <tbody>
                {mostWanted.map((p) => (
                  <tr key={p.sku} className="border-t border-[#ebe9f1]">
                    <td className="py-2 font-medium text-[#5e5873]">{p.sku}</td>
                    <td className="py-2 text-right text-[#6e6b7b]">{p.active_count}</td>
                    <td className="py-2 text-right text-[#b9b9c3]">{p.total_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <h3 className="text-[1rem] font-semibold text-[#5e5873] mb-3">Come funziona</h3>
        <div className="space-y-2 text-[0.875rem] text-[#6e6b7b]">
          <p>
            I <strong>Reminders</strong> permettono agli utenti di ricevere notifiche quando un prodotto esaurito torna disponibile.
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Gli utenti attivano un reminder dalla scheda prodotto</li>
            <li>Quando il prodotto torna disponibile, ricevono una notifica</li>
            <li>I reminders scadono automaticamente dopo il periodo impostato</li>
          </ul>
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
