"use client";

import { useEffect, useState, useCallback } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { Search, Trash2, ChevronLeft, ChevronRight, Link2, ExternalLink } from "lucide-react";
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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    fetchCorrelations();
  };

  const getProductName = (name: Record<string, string>) => {
    return name?.it || name?.en || Object.values(name || {})[0] || "—";
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Correlazioni & Analytics", href: "/b2b/correlations" },
          { label: "Articoli Correlati" },
        ]}
      />

      {/* Search Bar */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <form onSubmit={handleSearchSubmit} className="flex gap-3">
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
      </div>

      {/* Correlations Table */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="text-center text-[#5e5873]">
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
            <table className="w-full">
              <thead className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <tr>
                  <th className="px-4 py-3 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                    Prodotto Origine
                  </th>
                  <th className="px-4 py-3 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                    Prodotto Correlato
                  </th>
                  <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                    Bidirezionale
                  </th>
                  <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                    Data
                  </th>
                  <th className="px-4 py-3 text-center text-[0.75rem] font-semibold uppercase tracking-wide text-[#5e5873]">
                    Azioni
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ebe9f1]">
                {correlations.map((correlation) => (
                  <tr key={correlation.correlation_id} className="hover:bg-[#fafafc]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/b2b/pim/products/${correlation.source_entity_code}`}
                        className="flex items-center gap-3 group"
                      >
                        {correlation.source_product?.cover_image_url ? (
                          <Image
                            src={correlation.source_product.cover_image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-[#f3f2f7] flex items-center justify-center">
                            <span className="text-[0.65rem] text-[#b9b9c3]">N/A</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[0.875rem] font-medium text-[#5e5873] group-hover:text-[#009688] truncate">
                            {correlation.source_product ? getProductName(correlation.source_product.name) : "—"}
                          </p>
                          <p className="text-[0.75rem] text-[#b9b9c3] font-mono flex items-center gap-1">
                            {correlation.source_entity_code}
                            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/b2b/pim/products/${correlation.target_entity_code}`}
                        className="flex items-center gap-3 group"
                      >
                        {correlation.target_product.cover_image_url ? (
                          <Image
                            src={correlation.target_product.cover_image_url}
                            alt=""
                            width={40}
                            height={40}
                            className="rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-[#f3f2f7] flex items-center justify-center">
                            <span className="text-[0.65rem] text-[#b9b9c3]">N/A</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[0.875rem] font-medium text-[#5e5873] group-hover:text-[#009688] truncate">
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
                        <span className="inline-flex items-center rounded-full bg-[rgba(40,199,111,0.12)] px-2.5 py-0.5 text-[0.75rem] font-medium text-[#28c76f]">
                          Sì
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-[#f3f2f7] px-2.5 py-0.5 text-[0.75rem] font-medium text-[#b9b9c3]">
                          No
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-[0.8rem] text-[#6e6b7b]">
                      {new Date(correlation.created_at).toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(correlation.correlation_id)}
                        disabled={deleteLoading === correlation.correlation_id}
                        className="rounded p-1.5 text-[#ea5455] hover:bg-[rgba(234,84,85,0.12)] disabled:opacity-50 transition-colors"
                        title="Elimina correlazione"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

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
                    className="flex items-center gap-1 rounded-[0.358rem] border border-[#d8d6de] px-3 py-1.5 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Precedente
                  </button>
                  <button
                    onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page === pagination.totalPages}
                    className="flex items-center gap-1 rounded-[0.358rem] border border-[#d8d6de] px-3 py-1.5 text-[0.8rem] text-[#6e6b7b] hover:bg-[#fafafc] disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );
}
