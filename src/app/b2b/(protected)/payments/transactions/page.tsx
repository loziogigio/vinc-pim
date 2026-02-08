"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, Loader2, Receipt } from "lucide-react";
import { TransactionStatusBadge, ProviderBadge } from "@/components/payments";
import {
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  PAYMENT_PROVIDERS,
  PAYMENT_PROVIDER_LABELS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
} from "@/lib/constants/payment";
import type {
  TransactionStatus,
  PaymentProvider,
  PaymentType,
} from "@/lib/constants/payment";

interface TransactionItem {
  transaction_id: string;
  order_id?: string;
  provider: PaymentProvider;
  payment_type: PaymentType;
  gross_amount: number;
  currency: string;
  status: TransactionStatus;
  created_at: string;
}

const formatCurrency = (amount: number, currency: string = "EUR") =>
  new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

export default function TransactionsListPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (statusFilter) params.set("status", statusFilter);
    if (providerFilter) params.set("provider", providerFilter);
    if (typeFilter) params.set("payment_type", typeFilter);

    try {
      const res = await fetch(`/api/b2b/payments/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to fetch transactions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, statusFilter, providerFilter, typeFilter]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#5e5873]">Transazioni</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca per ID, ordine, email..."
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
          {TRANSACTION_STATUSES.map((s) => (
            <option key={s} value={s}>{TRANSACTION_STATUS_LABELS[s]}</option>
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
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tutti i tipi</option>
          {PAYMENT_TYPES.map((t) => (
            <option key={t} value={t}>{PAYMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Receipt className="w-10 h-10 mx-auto mb-2 text-slate-300" />
            <p>Nessuna transazione trovata</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">ID</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Ordine</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Provider</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Tipo</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Importo</th>
                <th className="text-center px-4 py-3 font-medium text-[#5e5873]">Stato</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Data</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr
                  key={tx.transaction_id}
                  className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors cursor-pointer"
                  onClick={() =>
                    (window.location.href = `${tenantPrefix}/b2b/payments/transactions/${tx.transaction_id}`)
                  }
                >
                  <td className="px-4 py-3 font-mono text-xs text-[#5e5873]">
                    ...{tx.transaction_id.slice(-12)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {tx.order_id || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ProviderBadge provider={tx.provider} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {PAYMENT_TYPE_LABELS[tx.payment_type]}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(tx.gross_amount, tx.currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <TransactionStatusBadge status={tx.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {new Date(tx.created_at).toLocaleDateString("it-IT")}
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
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} transazioni)
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
