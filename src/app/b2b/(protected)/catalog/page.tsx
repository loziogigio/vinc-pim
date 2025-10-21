"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import { ProductsTable } from "@/components/b2b/ProductsTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ChevronLeft, ChevronRight, Filter, Paintbrush } from "lucide-react";
import { cn } from "@/components/ui/utils";
import type { B2BProduct } from "@/lib/types/b2b";

type CatalogData = {
  products: B2BProduct[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export default function B2BCatalogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<CatalogData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams?.get("q") || "");
  const [currentFilter, setCurrentFilter] = useState(searchParams?.get("filter") || "");
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams?.get("page") || "1", 10));

  const fetchCatalog = async (page: number, query: string, filter: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      if (query) params.set("q", query);
      if (filter) params.set("filter", filter);

      const res = await fetch(`/api/b2b/catalog?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch catalog");
      }
      const catalogData = await res.json();
      setData(catalogData);
    } catch (error) {
      console.error("Catalog fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalog(currentPage, searchQuery, currentFilter);
  }, [currentPage, searchQuery, currentFilter]);

  const handleSearch = () => {
    setCurrentPage(1);
    fetchCatalog(1, searchQuery, currentFilter);
  };

  const handleEnhance = async (productIds: string[]) => {
    console.log("Enhancing products:", productIds);
    // TODO: Implement bulk enhancement API call
    alert(`Enhancing ${productIds.length} products (feature coming soon)`);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const renderEmptyState = (message: string, sub?: string) => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <p className="text-[1.05rem] font-semibold">{message}</p>
        {sub ? <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">{sub}</p> : null}
      </div>
    </div>
  );

  if (isLoading && !data) {
    return renderEmptyState("Loading product catalog…", "Pulling the latest assortment from your ERP.");
  }

  if (!data) {
    return renderEmptyState("No products available", "Try adjusting your filters or syncing new inventory.");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Breadcrumbs items={[{ label: "Product Catalog" }]} />
        <BackButton />
      </div>

      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-[1rem] font-semibold text-[#5e5873]">Product Catalog</h1>
            <p className="text-[0.8rem] text-[#b9b9c3]">Manage and enhance your product catalog</p>
          </div>
          <Button
            onClick={() => router.push("/b2b/product-builder")}
            className="h-9 rounded-[0.428rem] bg-[#009688] px-4 text-[0.8rem] shadow-[0_0_10px_1px_rgba(0,150,136,0.3)] transition hover:bg-[#00796b]"
          >
            <Paintbrush className="mr-1.5 h-4 w-4" />
            Product Page Builder
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#b9b9c3]" />
            <Input
              type="text"
              placeholder="Search by SKU, title, or category…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="h-9 rounded-[0.428rem] border-[#ebe9f1] pl-9 text-[0.82rem]"
            />
          </div>
          <Button onClick={handleSearch} className="h-9 rounded-[0.428rem] px-4 text-[0.8rem]">
            <Search className="mr-1.5 h-4 w-4" />
            Search
          </Button>
          <Button
            variant="outline"
            className="h-9 rounded-[0.428rem] border-[#ebe9f1] px-4 text-[0.8rem] text-[#5e5873]"
          >
            <Filter className="mr-1.5 h-4 w-4" />
            Filters
          </Button>
        </div>
      </div>

      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-4 shadow-[0_4px_24px_0_rgba(34,41,47,0.1)]">
        <div className="mb-3 flex items-center justify-between text-[0.8rem] text-[#6e6b7b]">
          <p>
            Showing {((data.pagination.page - 1) * data.pagination.limit) + 1} to{" "}
            {Math.min(data.pagination.page * data.pagination.limit, data.pagination.total)} of{" "}
            {data.pagination.total} products
          </p>
        </div>

        <ProductsTable products={data.products} onEnhance={handleEnhance} />

        {data.pagination.totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || isLoading}
              className="h-8 rounded-[0.358rem] border-[#ebe9f1] px-3 text-[0.75rem]"
            >
              <ChevronLeft className="mr-1 h-3 w-3" />
              Previous
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, data.pagination.totalPages) }, (_, i) => {
                const pageNumber = i + 1;
                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={isLoading}
                    className={cn(
                      "h-8 min-w-[32px] rounded-[0.358rem] px-0 text-[0.75rem]",
                      currentPage === pageNumber
                        ? "bg-[#009688] text-white shadow-[0_0_10px_1px_rgba(0,150,136,0.25)]"
                        : "border-[#ebe9f1] text-[#5e5873]"
                    )}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === data.pagination.totalPages || isLoading}
              className="h-8 rounded-[0.358rem] border-[#ebe9f1] px-3 text-[0.75rem]"
            >
              Next
              <ChevronRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
