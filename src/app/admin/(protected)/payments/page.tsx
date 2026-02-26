"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Banknote,
  Coins,
  Users,
  Receipt,
  Loader2,
} from "lucide-react";

interface AdminStats {
  total_volume: number;
  total_commissions: number;
  active_tenants: number;
  total_transactions: number;
}

const DEFAULT_STATS: AdminStats = {
  total_volume: 0,
  total_commissions: 0,
  active_tenants: 0,
  total_transactions: 0,
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

export default function AdminPaymentsDashboard() {
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS);
  const [isLoading, setIsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/payments/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats || DEFAULT_STATS);
      }
    } catch (error) {
      console.error("Error loading admin stats:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#5e5873]">
          Panoramica Pagamenti
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Statistiche aggregate su tutti i tenant.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Volume Totale"
            value={formatCurrency(stats.total_volume)}
            icon={Banknote}
            color="bg-green-50 text-green-600"
          />
          <StatCard
            label="Commissioni"
            value={formatCurrency(stats.total_commissions)}
            icon={Coins}
            color="bg-amber-50 text-amber-600"
          />
          <StatCard
            label="Tenant Attivi"
            value={String(stats.active_tenants)}
            icon={Users}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Transazioni"
            value={String(stats.total_transactions)}
            icon={Receipt}
            color="bg-purple-50 text-purple-600"
          />
        </div>
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
