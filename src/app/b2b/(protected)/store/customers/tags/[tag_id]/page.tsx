"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { AddCustomerToTagPanel } from "@/components/orders/AddCustomerToTagPanel";
import { AddAddressOverridePanel } from "@/components/orders/AddAddressOverridePanel";
import {
  Search,
  Users,
  UserPlus,
  UserMinus,
  MapPin,
  MapPinPlus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Building2,
  User,
  Store,
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface TagInfo {
  tag_id: string;
  prefix: string;
  code: string;
  full_tag: string;
  description: string;
  color?: string;
  customer_count: number;
}

interface CustomerEntry {
  customer_id: string;
  email?: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  customer_type?: string;
  public_code?: string;
  external_code?: string;
}

interface AddressOverrideEntry {
  customer_id: string;
  customer_name: string;
  address_id: string;
  address_label: string;
}

// ============================================
// HELPERS
// ============================================

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

function getCustomerCode(c: CustomerEntry): string {
  return c.public_code || c.external_code || c.customer_id;
}

// ============================================
// MAIN PAGE
// ============================================

export default function TagDetailPage() {
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";
  const tagId = pathname?.split("/tags/")[1] || "";

  const [tag, setTag] = useState<TagInfo | null>(null);
  const [isLoadingTag, setIsLoadingTag] = useState(true);

  // Assigned customers
  const [customers, setCustomers] = useState<CustomerEntry[]>([]);
  const [customerPagination, setCustomerPagination] = useState({
    page: 1, limit: 20, total: 0, totalPages: 0,
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [removingCustomerId, setRemovingCustomerId] = useState<string | null>(null);

  // Address overrides
  const [addressOverrides, setAddressOverrides] = useState<AddressOverrideEntry[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const [removingAddressKey, setRemovingAddressKey] = useState<string | null>(null);

  // Panel visibility
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddOverride, setShowAddOverride] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"customers" | "addresses">("customers");

  // ============================================
  // Load tag info
  // ============================================

  useEffect(() => {
    if (!tagId) return;
    (async () => {
      setIsLoadingTag(true);
      try {
        const res = await fetch("/api/b2b/customer-tags");
        if (res.ok) {
          const data = await res.json();
          const found = (data.tags || []).find(
            (t: TagInfo) => t.tag_id === tagId
          );
          setTag(found || null);
        }
      } catch (err) {
        console.error("Error loading tag:", err);
      } finally {
        setIsLoadingTag(false);
      }
    })();
  }, [tagId]);

  // ============================================
  // Load assigned customers
  // ============================================

  const loadCustomers = useCallback(async () => {
    if (!tagId) return;
    setIsLoadingCustomers(true);
    const params = new URLSearchParams({
      page: String(customerPage),
      limit: "20",
      include_addresses: "1",
    });
    if (customerSearch) params.set("search", customerSearch);

    try {
      const res = await fetch(`/api/b2b/customer-tags/${tagId}/customers?${params}`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setCustomerPagination(
          data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 }
        );
        if (data.address_overrides) {
          setAddressOverrides(data.address_overrides);
          setIsLoadingAddresses(false);
        }
      }
    } catch (err) {
      console.error("Error loading customers:", err);
    } finally {
      setIsLoadingCustomers(false);
    }
  }, [tagId, customerPage, customerSearch]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  // ============================================
  // Remove customer tag
  // ============================================

  const handleRemoveCustomer = async (customerId: string) => {
    if (!confirm("Remove tag from this customer?")) return;
    setRemovingCustomerId(customerId);
    try {
      const res = await fetch(`/api/b2b/customer-tags/${tagId}/customers`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: customerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setTag((prev) =>
          prev ? { ...prev, customer_count: data.customer_count } : prev
        );
        setCustomers((prev) => prev.filter((c) => c.customer_id !== customerId));
        setCustomerPagination((prev) => ({
          ...prev,
          total: prev.total - 1,
          totalPages: Math.ceil((prev.total - 1) / prev.limit),
        }));
      }
    } catch (err) {
      console.error("Error removing customer:", err);
    } finally {
      setRemovingCustomerId(null);
    }
  };

  // ============================================
  // Remove address override
  // ============================================

  const handleRemoveAddressOverride = async (
    customerId: string,
    addressId: string
  ) => {
    if (!tag) return;
    const key = `${customerId}:${addressId}`;
    if (!confirm("Remove tag override from this address?")) return;
    setRemovingAddressKey(key);
    try {
      const res = await fetch(
        `/api/b2b/customers/${customerId}/addresses/${addressId}/tags`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_tag: tag.full_tag }),
        }
      );
      if (res.ok) {
        setAddressOverrides((prev) =>
          prev.filter(
            (a) => !(a.customer_id === customerId && a.address_id === addressId)
          )
        );
      }
    } catch (err) {
      console.error("Error removing address override:", err);
    } finally {
      setRemovingAddressKey(null);
    }
  };

  // ============================================
  // Assign tag to customer (callback for panel)
  // ============================================

  const handleAssignCustomer = async (customerId: string) => {
    const res = await fetch(`/api/b2b/customer-tags/${tagId}/customers`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId }),
    });
    if (res.ok) {
      const data = await res.json();
      setTag((prev) =>
        prev ? { ...prev, customer_count: data.customer_count } : prev
      );
      loadCustomers();
    }
  };

  // ============================================
  // Assign address override (callback for panel)
  // ============================================

  const handleAssignAddressOverride = async (
    customerId: string,
    addressId: string,
    customerName: string,
    addressLabel: string
  ) => {
    if (!tag) return;
    const res = await fetch(
      `/api/b2b/customers/${customerId}/addresses/${addressId}/tags`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_tag: tag.full_tag }),
      }
    );
    if (res.ok) {
      setAddressOverrides((prev) => [
        ...prev,
        { customer_id: customerId, customer_name: customerName, address_id: addressId, address_label: addressLabel },
      ]);
    }
  };

  // ============================================
  // RENDER
  // ============================================

  if (isLoadingTag) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!tag) {
    return (
      <div className="p-6">
        <div className="p-12 text-center text-muted-foreground">
          Tag not found
        </div>
      </div>
    );
  }

  const assignedCustomerIds = new Set(customers.map((c) => c.customer_id));

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Store", href: "/b2b/store" },
          { label: "Customers", href: "/b2b/store/customers" },
          { label: "Customer Tags", href: "/b2b/store/customers/tags" },
          { label: tag.code },
        ]}
      />

      {/* Tag Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: tag.color || "#94a3b8" }}
          />
          <div>
            <h1 className="text-2xl font-bold text-foreground">{tag.code}</h1>
            <p className="text-sm text-muted-foreground">{tag.description}</p>
            <div className="flex items-center gap-3 mt-1">
              <code className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded font-mono">
                {tag.full_tag}
              </code>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {tag.customer_count} customers
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowAddCustomer((prev) => !prev)}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
        >
          <UserPlus className="h-4 w-4" />
          Add Customer
        </button>
      </div>

      {/* Add Customer Panel */}
      {showAddCustomer && (
        <AddCustomerToTagPanel
          assignedCustomerIds={assignedCustomerIds}
          onAssign={handleAssignCustomer}
          onClose={() => setShowAddCustomer(false)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-border flex gap-1">
        <button
          onClick={() => setActiveTab("customers")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "customers"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            Customers ({customerPagination.total})
          </span>
        </button>
        <button
          onClick={() => setActiveTab("addresses")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
            activeTab === "addresses"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            Address Overrides ({addressOverrides.length})
          </span>
        </button>
      </div>

      {/* Customers Tab */}
      {activeTab === "customers" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter assigned customers..."
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div className="rounded-lg bg-card shadow-sm border border-border overflow-hidden">
            {isLoadingCustomers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : customers.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                {customerSearch
                  ? "No customers match your search"
                  : "No customers assigned to this tag"}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Code</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Type</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((c) => {
                    const TypeIcon =
                      CUSTOMER_TYPE_ICONS[c.customer_type || ""] || User;
                    return (
                      <tr
                        key={c.customer_id}
                        className="border-b border-border hover:bg-muted/20 transition"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`${tenantPrefix}/b2b/store/customers/${c.customer_id}`}
                            className="font-medium text-foreground hover:text-emerald-600"
                          >
                            {getCustomerDisplayName(c)}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {getCustomerCode(c)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.email || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <TypeIcon className="h-3 w-3" />
                            {c.customer_type || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleRemoveCustomer(c.customer_id)}
                            disabled={removingCustomerId === c.customer_id}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            title="Remove tag"
                          >
                            {removingCustomerId === c.customer_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {customerPagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Page {customerPagination.page} of {customerPagination.totalPages} ({customerPagination.total} customers)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCustomerPage((p) => Math.max(1, p - 1))}
                    disabled={customerPage <= 1}
                    className="p-1 rounded hover:bg-muted disabled:opacity-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() =>
                      setCustomerPage((p) =>
                        Math.min(customerPagination.totalPages, p + 1)
                      )
                    }
                    disabled={customerPage >= customerPagination.totalPages}
                    className="p-1 rounded hover:bg-muted disabled:opacity-50"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Address Overrides Tab */}
      {activeTab === "addresses" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => setShowAddOverride((prev) => !prev)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition"
            >
              <MapPinPlus className="h-4 w-4" />
              Add Address Override
            </button>
          </div>

          {showAddOverride && (
            <AddAddressOverridePanel
              fullTag={tag.full_tag}
              onAssign={handleAssignAddressOverride}
              onClose={() => setShowAddOverride(false)}
            />
          )}

          <div className="rounded-lg bg-card shadow-sm border border-border overflow-hidden">
            {isLoadingAddresses ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : addressOverrides.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">
                <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                No addresses have this tag as override
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Address</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {addressOverrides.map((a) => {
                    const key = `${a.customer_id}:${a.address_id}`;
                    return (
                      <tr
                        key={key}
                        className="border-b border-border hover:bg-muted/20 transition"
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`${tenantPrefix}/b2b/store/customers/${a.customer_id}`}
                            className="font-medium text-foreground hover:text-emerald-600"
                          >
                            {a.customer_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {a.address_label}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              handleRemoveAddressOverride(a.customer_id, a.address_id)
                            }
                            disabled={removingAddressKey === key}
                            className="p-1.5 rounded text-muted-foreground hover:text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                            title="Remove override"
                          >
                            {removingAddressKey === key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserMinus className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
