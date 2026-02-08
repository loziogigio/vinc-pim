"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Coins } from "lucide-react";

interface CommissionEntry {
  tenant_id: string;
  tenant_name: string;
  commission_rate: number;
  total_collected: number;
  transaction_count: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(amount);

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<CommissionEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/payments/commissions");
      if (res.ok) {
        const data = await res.json();
        setCommissions(data.commissions || []);
      }
    } catch (error) {
      console.error("Error loading commissions:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalCollected = commissions.reduce((sum, c) => sum + c.total_collected, 0);
  const totalTransactions = commissions.reduce((sum, c) => sum + c.transaction_count, 0);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold text-[#5e5873]">Commissioni per Tenant</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Riepilogo commissioni raccolte da ogni tenant.
        </p>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 px-4 py-3 bg-white rounded-lg border border-[#ebe9f1]">
        <div>
          <p className="text-xs text-muted-foreground">Totale Commissioni</p>
          <p className="text-lg font-bold text-[#5e5873]">{formatCurrency(totalCollected)}</p>
        </div>
        <div className="w-px h-8 bg-[#ebe9f1]" />
        <div>
          <p className="text-xs text-muted-foreground">Transazioni Totali</p>
          <p className="text-lg font-bold text-[#5e5873]">{totalTransactions}</p>
        </div>
        <div className="w-px h-8 bg-[#ebe9f1]" />
        <div>
          <p className="text-xs text-muted-foreground">Tenant</p>
          <p className="text-lg font-bold text-[#5e5873]">{commissions.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : commissions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Coins className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>Nessuna commissione trovata</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Tenant</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">ID</th>
                <th className="text-center px-4 py-3 font-medium text-[#5e5873]">Tasso</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Commissioni Raccolte</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Transazioni</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => (
                <tr
                  key={c.tenant_id}
                  className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#5e5873]">
                    {c.tenant_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {c.tenant_id}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      {(c.commission_rate * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(c.total_collected)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.transaction_count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
