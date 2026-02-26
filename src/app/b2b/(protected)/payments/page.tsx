"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Receipt,
  Banknote,
  TrendingUp,
  Clock,
  CreditCard,
  Phone,
  RefreshCw,
  Settings,
  Loader2,
} from "lucide-react";
import { TransactionStatusBadge, ProviderBadge } from "@/components/payments";
import type { TransactionStatus } from "@/lib/constants/payment";
import type { PaymentProvider } from "@/lib/constants/payment";

interface Stats {
  total_transactions: number;
  total_volume: number;
  successful_rate: number;
  pending_count: number;
}

interface RecentTransaction {
  transaction_id: string;
  provider: PaymentProvider;
  gross_amount: number;
  currency: string;
  status: TransactionStatus;
  created_at: string;
}

const DEFAULT_STATS: Stats = {
  total_transactions: 0,
  total_volume: 0,
  successful_rate: 0,
  pending_count: 0,
};

const formatCurrency = (amount: number, currency: string = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

export default function PaymentsDashboardPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [recent, setRecent] = useState<RecentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, txRes] = await Promise.all([
        fetch("/api/b2b/payments/stats"),
        fetch("/api/b2b/payments/transactions?limit=5"),
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data.stats || DEFAULT_STATS);
      }
      if (txRes.ok) {
        const data = await txRes.json();
        setRecent(data.transactions || []);
      }
    } catch (error) {
      console.error("Error loading payment dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">Payments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dashboard pagamenti e transazioni
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Transazioni Totali"
              value={String(stats.total_transactions)}
              icon={Receipt}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Volume Completato"
              value={formatCurrency(stats.total_volume)}
              icon={Banknote}
              color="bg-green-50 text-green-600"
            />
            <StatCard
              label="Tasso Successo"
              value={`${stats.successful_rate}%`}
              icon={TrendingUp}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="In Attesa"
              value={String(stats.pending_count)}
              icon={Clock}
              color="bg-amber-50 text-amber-600"
            />
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <QuickAction
              href={`${tenantPrefix}/b2b/payments/transactions`}
              title="Transazioni"
              description="Tutte le transazioni"
              icon={Receipt}
            />
            <QuickAction
              href={`${tenantPrefix}/b2b/payments/gateways`}
              title="Gateway"
              description="Stato provider"
              icon={CreditCard}
            />
            <QuickAction
              href={`${tenantPrefix}/b2b/payments/moto`}
              title="Terminale MOTO"
              description="Pagamento telefonico"
              icon={Phone}
            />
            <QuickAction
              href={`${tenantPrefix}/b2b/payments/recurring`}
              title="Ricorrenti"
              description="Contratti attivi"
              icon={RefreshCw}
            />
          </div>

          {/* Recent Transactions */}
          <div className="bg-white rounded-lg border border-[#ebe9f1]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#ebe9f1]">
              <h2 className="font-medium text-[#5e5873]">
                Transazioni Recenti
              </h2>
              <Link
                href={`${tenantPrefix}/b2b/payments/transactions`}
                className="text-sm text-[#009688] hover:underline"
              >
                Vedi tutte
              </Link>
            </div>
            {recent.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p>Nessuna transazione trovata</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">ID</th>
                    <th className="text-left px-4 py-2 font-medium text-[#5e5873]">Provider</th>
                    <th className="text-right px-4 py-2 font-medium text-[#5e5873]">Importo</th>
                    <th className="text-center px-4 py-2 font-medium text-[#5e5873]">Stato</th>
                    <th className="text-right px-4 py-2 font-medium text-[#5e5873]">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((tx) => (
                    <tr
                      key={tx.transaction_id}
                      className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors cursor-pointer"
                      onClick={() =>
                        (window.location.href = `${tenantPrefix}/b2b/payments/transactions/${tx.transaction_id}`)
                      }
                    >
                      <td className="px-4 py-2 font-mono text-xs text-[#5e5873]">
                        {tx.transaction_id.slice(-12)}
                      </td>
                      <td className="px-4 py-2">
                        <ProviderBadge provider={tx.provider} />
                      </td>
                      <td className="px-4 py-2 text-right font-medium">
                        {formatCurrency(tx.gross_amount, tx.currency)}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <TransactionStatusBadge status={tx.status} />
                      </td>
                      <td className="px-4 py-2 text-right text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("it-IT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-[#5e5873]">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      className="block bg-white rounded-lg border border-[#ebe9f1] p-4 hover:border-[#009688]/30 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#009688]" />
        <div>
          <p className="font-medium text-[#5e5873]">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </Link>
  );
}
