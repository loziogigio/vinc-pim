"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { ProviderBadge } from "@/components/payments";
import {
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  CONTRACT_TYPE_LABELS,
} from "@/lib/constants/payment";
import type { PaymentProvider, ContractType } from "@/lib/constants/payment";

const CONTRACT_STATUSES = ["active", "paused", "cancelled", "expired"] as const;
type ContractStatus = (typeof CONTRACT_STATUSES)[number];

const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  active: "Attivo",
  paused: "In Pausa",
  cancelled: "Cancellato",
  expired: "Scaduto",
};

const CONTRACT_STATUS_COLORS: Record<ContractStatus, string> = {
  active: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-gray-100 text-gray-500",
};

interface ContractItem {
  contract_id: string;
  customer_id: string;
  provider: PaymentProvider;
  contract_type: ContractType;
  status: ContractStatus;
  card_last_four?: string;
  card_brand?: string;
  next_charge_date?: string;
  total_charges: number;
  total_amount_charged: number;
  created_at: string;
}

const formatCurrency = (amount: number, currency: string = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

export default function RecurringContractsPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [contracts, setContracts] = useState<ContractItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchContracts = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (providerFilter) params.set("provider", providerFilter);

    try {
      const res = await fetch(`/api/b2b/payments/recurring?${params}`);
      const data = await res.json();
      setContracts(data.contracts || []);
      setPagination(
        data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
      );
    } catch (err) {
      console.error("Failed to fetch contracts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, providerFilter]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#5e5873]">Contratti Ricorrenti</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca per ID, cliente..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tutti gli stati</option>
          {CONTRACT_STATUSES.map((s) => (
            <option key={s} value={s}>{CONTRACT_STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={providerFilter}
          onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tutti i provider</option>
          {PAYMENT_PROVIDERS.map((p) => (
            <option key={p} value={p}>{PAYMENT_PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : contracts.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <RefreshCw className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>Nessun contratto trovato</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">ID</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Cliente</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Tipo</th>
                <th className="text-center px-4 py-3 font-medium text-[#5e5873]">Stato</th>
                <th className="text-center px-4 py-3 font-medium text-[#5e5873]">Addebiti</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Totale</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Prossimo</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Creato</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr
                  key={c.contract_id}
                  className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#5e5873]">
                    ...{c.contract_id.slice(-12)}
                  </td>
                  <td className="px-4 py-3 text-[#5e5873]">
                    {c.customer_id}
                    {c.card_last_four && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        •••• {c.card_last_four}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <ProviderBadge provider={c.provider} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {CONTRACT_TYPE_LABELS[c.contract_type]}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        CONTRACT_STATUS_COLORS[c.status]
                      }`}
                    >
                      {CONTRACT_STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-muted-foreground">
                    {c.total_charges}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(c.total_amount_charged)}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {c.next_charge_date
                      ? new Date(c.next_charge_date).toLocaleDateString("it-IT")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("it-IT")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#ebe9f1]">
            <span className="text-sm text-muted-foreground">
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} contratti)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded hover:bg-[#f8f8f8] disabled:opacity-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded hover:bg-[#f8f8f8] disabled:opacity-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
