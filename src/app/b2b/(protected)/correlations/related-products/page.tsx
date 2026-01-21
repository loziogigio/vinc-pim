"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Link2,
  ExternalLink,
  CheckSquare,
  Square,
  Minus,
  AlertTriangle,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

type ProductData = {
  entity_code: string;
  sku?: string;
  name: Record<string, string>;
  cover_image_url?: string;
  price?: number;
};

type Correlation = {
  correlation_id: string;
  source_entity_code: string;
  target_entity_code: string;
  correlation_type: string;
  source_product?: ProductData;
  target_product: ProductData;
  is_bidirectional: boolean;
  position: number;
  created_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export default function RelatedProductsPage() {
  const [correlations, setCorrelations] = useState<Correlation[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const fetchCorrelations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        correlation_type: "related",
      });
      if (search) {
        params.set("source_entity_code", search);
      }

      const res = await fetch(`/api/b2b/correlations?${params}`);
      if (!res.ok) throw new Error("Failed to fetch correlations");

      const data = await res.json();
      setCorrelations(data.correlations);
      setPagination(data.pagination);
      // Clear selection when page changes
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error fetching correlations:", error);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.page, pagination.limit, search]);

  useEffect(() => {
    fetchCorrelations();
  }, [fetchCorrelations]);

  const handleDelete = async (correlationId: string) => {
    if (!confirm("Sei sicuro di voler eliminare questa correlazione?")) return;

    setDeleteLoading(correlationId);
    try {
      const res = await fetch(`/api/b2b/correlations/${correlationId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete correlation");

      // Refresh the list
      fetchCorrelations();
    } catch (error) {
      console.error("Error deleting correlation:", error);
      alert("Errore durante l'eliminazione");
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setBulkDeleteLoading(true);
    try {
      const res = await fetch("/api/b2b/correlations/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          correlation_ids: Array.from(selectedIds),
        }),
      });

      if (!res.ok) throw new Error("Failed to delete correlations");

      const data = await res.json();
      setShowDeleteModal(false);
      setSelectedIds(new Set());
      fetchCorrelations();

      // Show success message (could use toast)
      console.log(`Deleted ${data.result.deleted} correlations`);
    } catch (error) {
      console.error("Error bulk deleting correlations:", error);
      alert("Errore durante l'eliminazione multipla");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCorrelations();
  };

  const getProductName = (name: Record<string, string>) => {
    return name?.it || name?.en || Object.values(name || {})[0] || "—";
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === correlations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(correlations.map((c) => c.correlation_id)));
    }
  };

  const isAllSelected = correlations.length > 0 && selectedIds.size === correlations.length;
  const isSomeSelected = selectedIds.size > 0 && selectedIds.size < correlations.length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Correlazioni & Analytics", href: "/b2b/correlations" },
          { label: "Articoli Correlati" },
        ]}
      />

      {/* Search Bar & Actions */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex flex-1 min-w-[300px] gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#b9b9c3]" />
              <input
                type="text"
                placeholder="Cerca per codice prodotto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-[0.358rem] border border-[#d8d6de] bg-white pl-10 pr-4 py-2.5 text-[0.875rem] text-[#6e6b7b] placeholder:text-[#b9b9c3] focus:border-[#009688] focus:outline-none focus:ring-1 focus:ring-[#009688]"
              />
            </div>
            <button
              type="submit"
              className="rounded-[0.358rem] bg-[#009688] px-5 py-2.5 text-[0.875rem] font-medium text-white hover:bg-[#00897b] transition-colors"
            >
              Cerca
            </button>
          </form>

          {/* Bulk Delete Button */}
          {selectedIds.size > 0 && (
            <button
              onClick={() => setShowDeleteModal(true)}
              className="flex items-center gap-2 rounded-[0.358rem] bg-[#ea5455] px-4 py-2.5 text-[0.875rem] font-medium text-white hover:bg-[#e73d3e] transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              Elimina ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Selection Info Bar */}
        {selectedIds.size > 0 && (
          <div className="mt-3 flex items-center gap-3 rounded-[0.358rem] bg-[#f3f2f7] px-4 py-2">
            <span className="text-[0.85rem] text-[#5e5873]">
              {selectedIds.size} correlazion{selectedIds.size === 1 ? "e" : "i"} selezionat{selectedIds.size === 1 ? "a" : "e"}
            </span>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-[0.85rem] text-[#009688] hover:text-[#00796b] font-medium"
            >
              Deseleziona tutto
            </button>
          </div>
        )}
      </div>

      {/* Correlations Table */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center text-[#5e5873]">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#009688] border-r-transparent mb-3"></div>
              <p className="text-[0.95rem]">Caricamento correlazioni...</p>
            </div>
          </div>
        ) : correlations.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center text-[#5e5873]">
              <Link2 className="mx-auto h-12 w-12 text-[#b9b9c3] mb-3" />
              <p className="text-[1rem] font-medium">Nessuna correlazione trovata</p>
              <p className="text-[0.85rem] text-[#b9b9c3] mt-1">
                Importa le correlazioni dal sistema ERP oppure aggiungile manualmente.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                  <tr>
                    <th className="px-4 py-3 text-left w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center justify-center text-[#6e6b7b] hover:text-[#009688] transition-colors"
                        title={isAllSelected ? "Deseleziona tutto" : "Seleziona tutto"}
                      >
                        {isAllSelected ? (
                          <CheckSquare className="h-5 w-5 text-[#009688]" />
                        ) : isSomeSelected ? (
                          <Minus className="h-5 w-5 text-[#009688]" />
                        ) : (
                          <Square className="h-5 w-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                      Prodotto Origine
                    </th>
                    <th className="px-4 py-3 text-center w-16">
                      <Link2 className="h-4 w-4 mx-auto text-[#b9b9c3]" />
                    </th>
                    <th className="px-4 py-3 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                      Prodotto Correlato
                    </th>
                    <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                      Tipo
                    </th>
                    <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                      Data
                    </th>
                    <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873] w-20">
                      Azioni
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ebe9f1]">
                  {correlations.map((correlation) => {
                    const isSelected = selectedIds.has(correlation.correlation_id);
                    return (
                      <tr
                        key={correlation.correlation_id}
                        className={`hover:bg-[#fafafc] transition-colors ${isSelected ? "bg-[#f0fdf4]" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleSelect(correlation.correlation_id)}
                            className="flex items-center justify-center text-[#6e6b7b] hover:text-[#009688] transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-[#009688]" />
                            ) : (
                              <Square className="h-5 w-5" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/b2b/pim/products/${correlation.source_entity_code}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-[#f3f2f7] flex-shrink-0 border border-[#ebe9f1]">
                              {correlation.source_product?.cover_image_url ? (
                                <Image
                                  src={correlation.source_product.cover_image_url}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <span className="text-[0.6rem] text-[#b9b9c3]">N/A</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.875rem] font-medium text-[#5e5873] group-hover:text-[#009688] line-clamp-1 transition-colors">
                                {correlation.source_product
                                  ? getProductName(correlation.source_product.name)
                                  : "—"}
                              </p>
                              <p className="text-[0.75rem] text-[#b9b9c3] font-mono flex items-center gap-1">
                                {correlation.source_entity_code}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {correlation.is_bidirectional ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[rgba(0,150,136,0.12)]" title="Bidirezionale">
                              <svg className="h-4 w-4 text-[#009688]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M7 16l-4-4m0 0l4-4m-4 4h18M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                            </span>
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#f3f2f7]" title="Unidirezionale">
                              <svg className="h-4 w-4 text-[#b9b9c3]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/b2b/pim/products/${correlation.target_entity_code}`}
                            className="flex items-center gap-3 group"
                          >
                            <div className="h-12 w-12 rounded-lg overflow-hidden bg-[#f3f2f7] flex-shrink-0 border border-[#ebe9f1]">
                              {correlation.target_product.cover_image_url ? (
                                <Image
                                  src={correlation.target_product.cover_image_url}
                                  alt=""
                                  width={48}
                                  height={48}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <span className="text-[0.6rem] text-[#b9b9c3]">N/A</span>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[0.875rem] font-medium text-[#5e5873] group-hover:text-[#009688] line-clamp-1 transition-colors">
                                {getProductName(correlation.target_product.name)}
                              </p>
                              <p className="text-[0.75rem] text-[#b9b9c3] font-mono flex items-center gap-1">
                                {correlation.target_entity_code}
                                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {correlation.is_bidirectional ? (
                            <span className="inline-flex items-center rounded-full bg-[rgba(40,199,111,0.12)] px-2.5 py-1 text-[0.7rem] font-medium text-[#28c76f]">
                              Bidirezionale
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-[#f3f2f7] px-2.5 py-1 text-[0.7rem] font-medium text-[#82868b]">
                              Unidirezionale
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[0.8rem] text-[#6e6b7b]">
                          {new Date(correlation.created_at).toLocaleDateString("it-IT", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDelete(correlation.correlation_id)}
                            disabled={deleteLoading === correlation.correlation_id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-[#ea5455] hover:bg-[rgba(234,84,85,0.12)] disabled:opacity-50 transition-colors"
                            title="Elimina correlazione"
                          >
                            {deleteLoading === correlation.correlation_id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-[#ea5455] border-r-transparent"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#ebe9f1] px-4 py-3">
                <p className="text-[0.8rem] text-[#6e6b7b]">
                  Pagina {pagination.page} di {pagination.totalPages} ({pagination.total} risultati)
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="flex items-center gap-1 rounded-[0.358rem] border border-[#d8d6de] px-3 py-1.5 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="flex items-center gap-1 rounded-[0.358rem] border border-[#d8d6de] px-3 py-1.5 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Successiva
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowDeleteModal(false)}
          />
          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#ebe9f1]">
              <h3 className="text-[1.1rem] font-semibold text-[#5e5873]">
                Conferma Eliminazione
              </h3>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="text-[#b9b9c3] hover:text-[#5e5873] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-[rgba(234,84,85,0.12)] flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-[#ea5455]" />
                </div>
                <div>
                  <p className="text-[0.95rem] text-[#5e5873]">
                    Stai per eliminare{" "}
                    <span className="font-semibold">{selectedIds.size}</span>{" "}
                    correlazion{selectedIds.size === 1 ? "e" : "i"}.
                  </p>
                  <p className="text-[0.85rem] text-[#b9b9c3] mt-1">
                    Questa azione non può essere annullata.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-[#f8f8f8] border-t border-[#ebe9f1]">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-[0.875rem] font-medium text-[#6e6b7b] hover:text-[#5e5873] transition-colors"
              >
                Annulla
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleteLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-[0.358rem] bg-[#ea5455] text-[0.875rem] font-medium text-white hover:bg-[#e73d3e] disabled:opacity-50 transition-colors"
              >
                {bulkDeleteLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                    Eliminazione...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Elimina
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
