"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  X,
  Search,
  Loader2,
  UserMinus,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Store,
  Users,
} from "lucide-react";

interface CustomerEntry {
  customer_id: string;
  email?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  customer_type?: string;
}

interface TagCustomersPanelProps {
  tagId: string;
  fullTag: string;
  tagCode: string;
  tagColor?: string;
  tagDescription: string;
  customerCount: number;
  tenantPrefix: string;
  onClose: () => void;
  onCountChange: (tagId: string, newCount: number) => void;
}

const CUSTOMER_TYPE_ICONS: Record<string, React.ElementType> = {
  business: Building2,
  private: User,
  reseller: Store,
};

function getCustomerDisplayName(c: CustomerEntry): string {
  if (c.company_name) return c.company_name;
  const parts = [c.first_name, c.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return c.email || c.customer_id;
}

export function TagCustomersPanel({
  tagId,
  fullTag,
  tagCode,
  tagColor,
  tagDescription,
  customerCount,
  tenantPrefix,
  onClose,
  onCountChange,
}: TagCustomersPanelProps) {
  const [customers, setCustomers] = useState<CustomerEntry[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
    });
    if (search) params.set("search", search);

    try {
      const res = await fetch(
        `/api/b2b/customer-tags/${tagId}/customers?${params}`
      );
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setPagination(
          data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
        );
      }
    } catch (err) {
      console.error("Error loading tag customers:", err);
    } finally {
      setIsLoading(false);
    }
  }, [tagId, page, search]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const handleRemove = async (customerId: string) => {
    if (
      !confirm(
        `Remove tag "${fullTag}" from customer ${customerId}?`
      )
    )
      return;

    setRemovingId(customerId);
    try {
      const res = await fetch(`/api/b2b/customer-tags/${tagId}/customers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (res.ok) {
        const data = await res.json();
        onCountChange(tagId, data.customer_count);
        // Remove from local list
        setCustomers((prev) =>
          prev.filter((c) => c.customer_id !== customerId)
        );
        setPagination((prev) => ({
          ...prev,
          total: prev.total - 1,
          totalPages: Math.ceil((prev.total - 1) / prev.limit),
        }));
      }
    } catch (err) {
      console.error("Error removing tag:", err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="rounded-lg bg-card shadow-sm border border-border">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: tagColor || "#94a3b8" }}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{tagCode}</span>
              <code className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-mono">
                {fullTag}
              </code>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {customerCount}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {tagDescription}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Search within tag customers */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search customers with this tag..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
      </div>

      {/* Customer list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : customers.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground text-sm">
          {search
            ? "No customers match your search"
            : "No customers assigned to this tag"}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {customers.map((c) => {
            const TypeIcon =
              CUSTOMER_TYPE_ICONS[c.customer_type || ""] || User;
            return (
              <div
                key={c.customer_id}
                className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <TypeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <Link
                      href={`${tenantPrefix}/b2b/store/customers/${c.customer_id}`}
                      className="text-sm font-medium text-foreground hover:text-emerald-600 truncate block"
                    >
                      {getCustomerDisplayName(c)}
                    </Link>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono">{c.customer_id}</span>
                      {c.email && (
                        <>
                          <span>&middot;</span>
                          <span className="truncate">{c.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(c.customer_id)}
                  disabled={removingId === c.customer_id}
                  className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50 flex-shrink-0"
                  title={`Remove tag from ${getCustomerDisplayName(c)}`}
                >
                  {removingId === c.customer_id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <UserMinus className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} customers)
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() =>
                setPage((p) => Math.min(pagination.totalPages, p + 1))
              }
              disabled={page >= pagination.totalPages}
              className="p-1 rounded hover:bg-muted disabled:opacity-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
