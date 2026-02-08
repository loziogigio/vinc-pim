"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Search, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_STATUSES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import { DocumentStatusBadge } from "@/components/documents";

interface DocumentItem {
  document_id: string;
  document_type: DocumentType;
  document_number?: string;
  status: DocumentStatus;
  customer: { company_name?: string; first_name?: string; last_name?: string };
  totals: { total: number };
  currency: string;
  created_at: string;
}

export default function DocumentListPage() {
  const pathname = usePathname();
  const tenantPrefix = pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);

    try {
      const res = await fetch(`/api/b2b/documents?${params}`);
      const data = await res.json();
      setDocuments(data.documents || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
    } catch (err) {
      console.error("Failed to fetch documents:", err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const formatCurrency = (amount: number, currency: string = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold text-[#5e5873]">Tutti i Documenti</h1>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca per numero, cliente, P.IVA..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tutti i tipi</option>
          {DOCUMENT_TYPES.map((t) => (
            <option key={t} value={t}>{DOCUMENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none"
        >
          <option value="">Tutti gli stati</option>
          {DOCUMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Nessun documento trovato.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Numero</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Tipo</th>
                <th className="text-left px-4 py-3 font-medium text-[#5e5873]">Cliente</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Totale</th>
                <th className="text-center px-4 py-3 font-medium text-[#5e5873]">Stato</th>
                <th className="text-right px-4 py-3 font-medium text-[#5e5873]">Data</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => {
                const customerName =
                  doc.customer?.company_name ||
                  [doc.customer?.first_name, doc.customer?.last_name].filter(Boolean).join(" ") ||
                  "—";
                return (
                  <tr
                    key={doc.document_id}
                    className="border-b border-[#ebe9f1] hover:bg-[#f8f8f8] transition-colors cursor-pointer"
                    onClick={() => window.location.href = `${tenantPrefix}/b2b/documents/${doc.document_id}`}
                  >
                    <td className="px-4 py-3 font-medium text-[#5e5873]">
                      {doc.document_number || <span className="text-muted-foreground italic">Bozza</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {DOCUMENT_TYPE_LABELS[doc.document_type]}
                    </td>
                    <td className="px-4 py-3 text-[#5e5873]">{customerName}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatCurrency(doc.totals?.total || 0, doc.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <DocumentStatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#ebe9f1]">
            <span className="text-sm text-muted-foreground">
              Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} documenti)
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
