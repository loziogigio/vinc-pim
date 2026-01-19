"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import type { Customer } from "@/lib/types/customer";
import {
  Search,
  Users,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Store,
  X,
  Eye,
  MapPin,
  ShoppingCart,
  Euro,
} from "lucide-react";

type FilterState = {
  search: string;
  customer_type: string;
  is_guest: string;
};

type OrderStats = {
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
  draft_count: number;
};

type CustomerWithStats = Customer & {
  order_stats?: OrderStats;
};

export default function CustomersListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Extract tenant from URL (e.g., /dfl-eventi-it/b2b/store/customers/list -> dfl-eventi-it)
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";
  const basePath = `${tenantPrefix}/b2b/store/customers`;

  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState<FilterState>({
    search: searchParams?.get("search") || "",
    customer_type: searchParams?.get("customer_type") || "",
    is_guest: searchParams?.get("is_guest") || "",
  });

  useEffect(() => {
    fetchCustomers();
  }, [searchParams]);

  async function fetchCustomers() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", searchParams?.get("page") || "1");
      params.set("limit", "20");

      if (filters.customer_type) params.set("customer_type", filters.customer_type);
      if (filters.is_guest) params.set("is_guest", filters.is_guest);
      if (filters.search) params.set("search", filters.search);

      const res = await fetch(`/api/b2b/customers?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function updateFilters(updates: Partial<FilterState>) {
    const newFilters = { ...filters, ...updates };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      }
    });
    params.set("page", "1");

    router.push(`${basePath}/list?${params.toString()}`);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", page.toString());
    router.push(`${basePath}/list?${params.toString()}`);
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "business":
        return <Building2 className="h-4 w-4" />;
      case "private":
        return <User className="h-4 w-4" />;
      case "reseller":
        return <Store className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      business: "bg-emerald-100 text-emerald-700",
      private: "bg-purple-100 text-purple-700",
      reseller: "bg-amber-100 text-amber-700",
    };
    return styles[type] || "bg-gray-100 text-gray-700";
  };

  const renderEmptyState = () => (
    <div className="flex h-[50vh] items-center justify-center rounded-[0.428rem] border border-[#ebe9f1] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
      <div className="text-center text-[#5e5873]">
        <Users className="mx-auto h-12 w-12 text-[#b9b9c3] mb-3" />
        <p className="text-[1.05rem] font-semibold">No customers found</p>
        <p className="mt-1 text-[0.85rem] text-[#b9b9c3]">
          {filters.search || filters.customer_type
            ? "Try adjusting your filters"
            : "Customers will appear here once created"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Customers", href: basePath },
          { label: "All Customers" },
        ]}
      />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">All Customers</h1>
          <p className="text-sm text-muted-foreground">
            Manage your customer profiles ({pagination.total} total)
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-lg bg-card p-3.5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by public code, email, name, or company..."
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value })}
              className="w-full rounded border border-border bg-background px-9 py-2 text-sm focus:border-primary focus:outline-none"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filters.customer_type}
            onChange={(e) => updateFilters({ customer_type: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Types</option>
            <option value="business">Business</option>
            <option value="private">Private</option>
            <option value="reseller">Reseller</option>
          </select>

          {/* Guest Filter */}
          <select
            value={filters.is_guest}
            onChange={(e) => updateFilters({ is_guest: e.target.value })}
            className="rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
          >
            <option value="">All Customers</option>
            <option value="false">Registered</option>
            <option value="true">Guests</option>
          </select>
        </div>

        {/* Active Filters */}
        {(filters.customer_type || filters.search || filters.is_guest) && (
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {filters.customer_type && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Type: {filters.customer_type}</span>
                <button
                  onClick={() => updateFilters({ customer_type: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.is_guest && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>{filters.is_guest === "true" ? "Guests" : "Registered"}</span>
                <button
                  onClick={() => updateFilters({ is_guest: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            {filters.search && (
              <div className="flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                <span>Search: &quot;{filters.search}&quot;</span>
                <button
                  onClick={() => updateFilters({ search: "" })}
                  className="hover:bg-primary/20 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
            <button
              onClick={() => updateFilters({ customer_type: "", is_guest: "", search: "" })}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Customers Table */}
      <div className="rounded-lg bg-card shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : customers.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Customer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Email
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                      Addresses
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      VAT Number
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {customers.map((customer) => (
                    <tr key={customer.customer_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${getTypeBadge(customer.customer_type)}`}>
                            {getTypeIcon(customer.customer_type)}
                          </div>
                          <div>
                            <Link
                              href={`${basePath}/${customer.customer_id}`}
                              className="font-medium text-foreground hover:text-primary"
                            >
                              {customer.company_name || `${customer.first_name || ""} ${customer.last_name || ""}`.trim() || "Unnamed"}
                            </Link>
                            {/* Customer Codes: public_code (primary) + external_code (ERP) */}
                            <div className="flex items-center gap-2 text-xs">
                              {customer.public_code && (
                                <span className="text-primary font-mono font-semibold" title="Public Customer Code">
                                  {customer.public_code}
                                </span>
                              )}
                              {customer.external_code && (
                                <span className="text-muted-foreground font-mono" title="ERP Code">
                                  ({customer.external_code})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-foreground">{customer.email}</span>
                        {customer.phone && (
                          <div className="text-xs text-muted-foreground">{customer.phone}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeBadge(customer.customer_type)}`}>
                          {getTypeIcon(customer.customer_type)}
                          {customer.customer_type}
                        </span>
                        {customer.is_guest && (
                          <span className="ml-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                            Guest
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {customer.addresses?.length || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {customer.legal_info?.vat_number ? (
                          <span className="text-sm font-mono text-foreground">
                            {customer.legal_info.vat_number}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(customer.created_at).toLocaleDateString("it-IT", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${basePath}/${customer.customer_id}`}
                          className="flex items-center justify-end gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="border-t border-border px-4 py-3 flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of{" "}
                  {pagination.total} customers
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => goToPage(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-medium text-foreground">
                    Page {pagination.page} of {pagination.pages}
                  </div>
                  <button
                    onClick={() => goToPage(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
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
