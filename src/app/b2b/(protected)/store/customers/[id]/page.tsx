"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import type { Customer, Address } from "@/lib/types/customer";
import type { Order } from "@/lib/types/order";
import { CustomerTagsCard } from "@/components/orders/CustomerTagsCard";
import { AddressTagOverrides } from "@/components/orders/AddressTagOverrides";
import { AddAddressModal } from "@/components/orders/AddAddressModal";
import {
  ArrowLeft,
  Building2,
  User,
  Store,
  Mail,
  Phone,
  MapPin,
  FileText,
  Calendar,
  Edit,
  Trash2,
  Plus,
  Home,
  Briefcase,
  ShoppingCart,
  Euro,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  Eye,
  TrendingUp,
} from "lucide-react";

type OrderStats = {
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
  first_order_date: string | null;
  draft_count: number;
  pending_count: number;
  confirmed_count: number;
  shipped_count: number;
  cancelled_count: number;
  avg_order_value: number;
  // Time-based stats
  orders_30d: number;
  spent_30d: number;
  orders_60d: number;
  spent_60d: number;
  orders_90d: number;
  spent_90d: number;
};

type AddressStats = {
  address_id: string;
  address_label: string;
  address_city?: string;
  address_type?: string;
  order_count: number;
  total_spent: number;
  last_order_date: string | null;
};

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const pathname = usePathname();
  const router = useRouter();

  // Extract tenant from URL (e.g., /dfl-eventi-it/b2b/store/customers/123 -> dfl-eventi-it)
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderStats, setOrderStats] = useState<OrderStats | null>(null);
  const [addressStats, setAddressStats] = useState<AddressStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [addressFilter, setAddressFilter] = useState<string>("all");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isCreatingOrder, setIsCreatingOrder] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [requiresDelivery, setRequiresDelivery] = useState(true);

  useEffect(() => {
    fetchCustomer();
    fetchOrders();
  }, [id]);

  async function fetchCustomer() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/b2b/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data.customer);
        if (data.customer.order_stats) {
          setOrderStats(data.customer.order_stats);
        }
        if (data.customer.orders_by_address) {
          setAddressStats(data.customer.orders_by_address);
        }
      } else if (res.status === 404) {
        setError("Customer not found");
      } else {
        setError("Failed to load customer");
      }
    } catch (err) {
      console.error("Error fetching customer:", err);
      setError("Failed to load customer");
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchOrders(filter?: string, addrFilter?: string) {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("customer_id", id);
      params.set("limit", "50");

      // Apply date filter
      const filterValue = filter || dateFilter;
      if (filterValue !== "all") {
        const now = new Date();
        let dateFrom: Date;
        switch (filterValue) {
          case "30d":
            dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
          case "60d":
            dateFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
            break;
          case "90d":
            dateFrom = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
          default:
            dateFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        }
        params.set("date_from", dateFrom.toISOString().split("T")[0]);
      }

      // Apply address filter
      const addressValue = addrFilter !== undefined ? addrFilter : addressFilter;
      if (addressValue !== "all") {
        params.set("shipping_address_id", addressValue);
      }

      const res = await fetch(`/api/b2b/orders?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error("Error fetching orders:", err);
    } finally {
      setOrdersLoading(false);
    }
  }

  function handleDateFilterChange(filter: string) {
    setDateFilter(filter);
    fetchOrders(filter, addressFilter);
  }

  function handleAddressFilterChange(addrId: string) {
    setAddressFilter(addrId);
    fetchOrders(dateFilter, addrId);
  }

  function openCreateOrderModal() {
    // Pre-select default delivery address if available
    const defaultAddress = customer?.addresses?.find(
      (a) => a.is_default && (a.address_type === "delivery" || a.address_type === "both")
    );
    const firstDeliveryAddress = customer?.addresses?.find(
      (a) => a.address_type === "delivery" || a.address_type === "both"
    );
    setSelectedAddressId(defaultAddress?.address_id || firstDeliveryAddress?.address_id || "");
    setRequiresDelivery(true); // Default to product order
    setShowCreateOrderModal(true);
  }

  async function handleCreateOrder() {
    if (!customer) return;

    setIsCreatingOrder(true);
    try {
      const res = await fetch("/api/b2b/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: customer.customer_id,
          shipping_address_id: requiresDelivery && selectedAddressId ? selectedAddressId : undefined,
          requires_delivery: requiresDelivery,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setShowCreateOrderModal(false);
        router.push(`${tenantPrefix}/b2b/store/orders/${data.order.order_id}`);
      } else {
        const error = await res.json();
        alert(error.error || "Failed to create order");
      }
    } catch (err) {
      console.error("Error creating order:", err);
      alert("Failed to create order");
    } finally {
      setIsCreatingOrder(false);
    }
  }

  async function handleDelete() {
    if (!customer) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/b2b/customers/${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        router.push(`${tenantPrefix}/b2b/store/customers/list`);
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete customer");
      }
    } catch (err) {
      console.error("Error deleting customer:", err);
      alert("Failed to delete customer");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "business":
        return <Building2 className="h-5 w-5" />;
      case "private":
        return <User className="h-5 w-5" />;
      case "reseller":
        return <Store className="h-5 w-5" />;
      default:
        return <User className="h-5 w-5" />;
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

  const getAddressIcon = (type: string) => {
    switch (type) {
      case "delivery":
        return <Home className="h-4 w-4" />;
      case "billing":
        return <Briefcase className="h-4 w-4" />;
      case "both":
        return <MapPin className="h-4 w-4" />;
      default:
        return <MapPin className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ElementType }> = {
      draft: { bg: "bg-amber-100 text-amber-700", icon: ShoppingCart },
      pending: { bg: "bg-blue-100 text-blue-700", icon: Clock },
      confirmed: { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
      shipped: { bg: "bg-purple-100 text-purple-700", icon: Truck },
      cancelled: { bg: "bg-gray-100 text-gray-700", icon: XCircle },
    };
    return styles[status] || { bg: "bg-gray-100 text-gray-700", icon: ShoppingCart };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("it-IT", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Customers", href: `${tenantPrefix}/b2b/store/customers` },
            { label: "Error" },
          ]}
        />
        <div className="rounded-lg bg-card p-8 shadow-sm text-center">
          <User className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <h2 className="text-lg font-semibold text-foreground mb-2">
            {error || "Customer not found"}
          </h2>
          <Link
            href={`${tenantPrefix}/b2b/store/customers`}
            className="text-primary hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to customers
          </Link>
        </div>
      </div>
    );
  }

  const displayName = customer.company_name ||
    `${customer.first_name || ""} ${customer.last_name || ""}`.trim() ||
    "Unnamed Customer";

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Customers", href: `${tenantPrefix}/b2b/store/customers` },
          { label: displayName },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`${tenantPrefix}/b2b/store/customers`}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-lg ${getTypeBadge(customer.customer_type)}`}>
              {getTypeIcon(customer.customer_type)}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-foreground">{displayName}</h1>
                {/* Public Code - Most important for administrative purposes */}
                {customer.public_code && (
                  <span className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-mono font-bold text-sm">
                    {customer.public_code}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getTypeBadge(customer.customer_type)}`}>
                  {customer.customer_type}
                </span>
                {customer.is_guest && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                    Guest
                  </span>
                )}
                {/* ERP Code - Secondary */}
                {customer.external_code && (
                  <span className="text-xs text-muted-foreground font-mono" title="ERP Code">
                    ERP: {customer.external_code}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateOrderModal}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition"
          >
            <Plus className="h-4 w-4" />
            Create Order
          </button>
          <button className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted transition">
            <Edit className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Create Order Modal */}
      {showCreateOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Create Order for {displayName}
            </h3>
            {/* Order Type Selection */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Order Type</p>
              <div className="grid grid-cols-2 gap-2">
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    requiresDelivery
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="orderType"
                    checked={requiresDelivery}
                    onChange={() => setRequiresDelivery(true)}
                  />
                  <div>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Truck className="h-4 w-4" />
                      Product
                    </span>
                    <p className="text-xs text-muted-foreground">Requires delivery</p>
                  </div>
                </label>
                <label
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    !requiresDelivery
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="radio"
                    name="orderType"
                    checked={!requiresDelivery}
                    onChange={() => setRequiresDelivery(false)}
                  />
                  <div>
                    <span className="font-medium text-foreground flex items-center gap-1">
                      <Briefcase className="h-4 w-4" />
                      Service
                    </span>
                    <p className="text-xs text-muted-foreground">No delivery needed</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Address Selection - Only show for Product orders */}
            {requiresDelivery && (
              <>
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase">Delivery Address</p>
                {customer.addresses && customer.addresses.filter((a) => a.address_type === "delivery" || a.address_type === "both").length > 0 ? (
                  <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                    {customer.addresses
                      .filter((a) => a.address_type === "delivery" || a.address_type === "both")
                      .map((address: Address) => (
                        <label
                          key={address.address_id}
                          className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                            selectedAddressId === address.address_id
                              ? "border-primary bg-primary/5"
                              : "border-border hover:bg-muted/50"
                          }`}
                        >
                          <input
                            type="radio"
                            name="address"
                            value={address.address_id}
                            checked={selectedAddressId === address.address_id}
                            onChange={(e) => setSelectedAddressId(e.target.value)}
                            className="mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {address.label || address.recipient_name}
                              </span>
                              {address.is_default && (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                  Default
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {address.street_address}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {address.postal_code} {address.city} ({address.province})
                            </p>
                          </div>
                        </label>
                      ))}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                    <p className="text-sm text-amber-700">
                      No delivery addresses found. The order will be created without a shipping address.
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowCreateOrderModal(false)}
                disabled={isCreatingOrder}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={isCreatingOrder}
                className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingOrder ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Customer
            </h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete <strong>{displayName}</strong>? This action cannot be undone.
            </p>
            {orderStats && orderStats.order_count > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-amber-700">
                  This customer has {orderStats.order_count} order(s). Deleting will not remove the orders.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-4 w-4" />
            Contact Information
          </h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <a href={`mailto:${customer.email}`} className="text-sm text-primary hover:underline">
                  {customer.email}
                </a>
              </div>
            </div>
            {customer.phone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <a href={`tel:${customer.phone}`} className="text-sm text-foreground">
                    {customer.phone}
                  </a>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Customer Since</p>
                <p className="text-sm text-foreground">
                  {new Date(customer.created_at).toLocaleDateString("it-IT", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Legal Info */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Legal Information
          </h2>
          {customer.legal_info && (customer.legal_info.vat_number || customer.legal_info.fiscal_code || customer.legal_info.pec_email || customer.legal_info.sdi_code) ? (
            <div className="space-y-4">
              {customer.legal_info.vat_number && (
                <div>
                  <p className="text-xs text-muted-foreground">VAT Number (P.IVA)</p>
                  <p className="text-sm font-mono text-foreground">{customer.legal_info.vat_number}</p>
                </div>
              )}
              {customer.legal_info.fiscal_code && (
                <div>
                  <p className="text-xs text-muted-foreground">Fiscal Code</p>
                  <p className="text-sm font-mono text-foreground">{customer.legal_info.fiscal_code}</p>
                </div>
              )}
              {customer.legal_info.pec_email && (
                <div>
                  <p className="text-xs text-muted-foreground">PEC Email</p>
                  <a href={`mailto:${customer.legal_info.pec_email}`} className="text-sm text-primary hover:underline">
                    {customer.legal_info.pec_email}
                  </a>
                </div>
              )}
              {customer.legal_info.sdi_code && (
                <div>
                  <p className="text-xs text-muted-foreground">SDI Code</p>
                  <p className="text-sm font-mono text-foreground">{customer.legal_info.sdi_code}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No legal information provided</p>
          )}
        </div>

        {/* Customer Codes & IDs */}
        <div className="rounded-lg bg-card p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Identification Codes</h2>
          <div className="space-y-4">
            {/* Public Customer Code - Primary */}
            <div>
              <p className="text-xs text-muted-foreground">Public Customer Code</p>
              {customer.public_code ? (
                <p className="text-lg font-mono font-bold text-primary">{customer.public_code}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not assigned</p>
              )}
            </div>
            {/* ERP Code - Secondary */}
            <div>
              <p className="text-xs text-muted-foreground">Customer Code (ERP)</p>
              {customer.external_code ? (
                <p className="text-sm font-mono text-foreground">{customer.external_code}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not assigned</p>
              )}
            </div>
            {/* Internal ID */}
            <div>
              <p className="text-xs text-muted-foreground">Internal ID</p>
              <p className="text-xs font-mono text-muted-foreground">{customer.customer_id}</p>
            </div>
            {customer.tenant_id && (
              <div>
                <p className="text-xs text-muted-foreground">Tenant</p>
                <p className="text-sm font-mono bg-primary/10 text-primary px-2 py-0.5 rounded inline-block">
                  {customer.tenant_id}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-sm text-foreground">
                {new Date(customer.updated_at).toLocaleDateString("it-IT", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customer Tags */}
      <CustomerTagsCard customerId={id} />

      {/* Addresses */}
      <div className="rounded-lg bg-card shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Addresses ({customer.addresses?.length || 0})
          </h2>
          <button
            onClick={() => setShowAddAddress(true)}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <Plus className="h-4 w-4" />
            Add Address
          </button>
        </div>
        {customer.addresses && customer.addresses.length > 0 ? (
          <div className="divide-y divide-border">
            {customer.addresses.map((address: Address) => (
              <div key={address.address_id} className="p-4 hover:bg-muted/30 transition">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      address.address_type === "delivery"
                        ? "bg-blue-100 text-blue-600"
                        : address.address_type === "billing"
                        ? "bg-green-100 text-green-600"
                        : "bg-purple-100 text-purple-600"
                    }`}>
                      {getAddressIcon(address.address_type)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">
                          {address.label || address.recipient_name}
                        </p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          address.address_type === "delivery"
                            ? "bg-blue-100 text-blue-600"
                            : address.address_type === "billing"
                            ? "bg-green-100 text-green-600"
                            : "bg-purple-100 text-purple-600"
                        }`}>
                          {address.address_type}
                        </span>
                        {address.is_default && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-foreground mt-1">{address.recipient_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {address.street_address}
                        {address.street_address_2 && `, ${address.street_address_2}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.postal_code} {address.city} ({address.province}) - {address.country}
                      </p>
                      {address.phone && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <Phone className="h-3 w-3 inline mr-1" />
                          {address.phone}
                        </p>
                      )}
                      {address.external_code && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          Code: {address.external_code}
                        </p>
                      )}
                      {/* Address Tag Overrides */}
                      <AddressTagOverrides
                        customerId={id}
                        addressId={address.address_id}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-muted-foreground hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <MapPin className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>No addresses added yet</p>
          </div>
        )}
      </div>

      {/* Order Stats Cards - Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Orders</p>
              <p className="text-xl font-bold text-foreground">
                {orderStats?.order_count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 text-emerald-600">
              <Euro className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Spent</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(orderStats?.total_spent || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-600">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Avg Order Value</p>
              <p className="text-xl font-bold text-foreground">
                {formatCurrency(orderStats?.avg_order_value || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 text-purple-600">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Order</p>
              <p className="text-sm font-medium text-foreground">
                {orderStats?.last_order_date
                  ? new Date(orderStats.last_order_date).toLocaleDateString("it-IT", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "No orders yet"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Time-based Stats */}
      <div className="rounded-lg bg-card shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Orders by Period
          </h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-border">
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Last 30 Days</p>
            <p className="text-2xl font-bold text-foreground">{orderStats?.orders_30d || 0}</p>
            <p className="text-sm text-emerald-600 font-medium">
              {formatCurrency(orderStats?.spent_30d || 0)}
            </p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Last 60 Days</p>
            <p className="text-2xl font-bold text-foreground">{orderStats?.orders_60d || 0}</p>
            <p className="text-sm text-emerald-600 font-medium">
              {formatCurrency(orderStats?.spent_60d || 0)}
            </p>
          </div>
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Last 90 Days</p>
            <p className="text-2xl font-bold text-foreground">{orderStats?.orders_90d || 0}</p>
            <p className="text-sm text-emerald-600 font-medium">
              {formatCurrency(orderStats?.spent_90d || 0)}
            </p>
          </div>
        </div>
        {/* Status Breakdown */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-3">Status Breakdown</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-sm">
              <ShoppingCart className="h-3 w-3" />
              <span>{orderStats?.draft_count || 0} Draft</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-sm">
              <Clock className="h-3 w-3" />
              <span>{orderStats?.pending_count || 0} Pending</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-sm">
              <CheckCircle2 className="h-3 w-3" />
              <span>{orderStats?.confirmed_count || 0} Confirmed</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 text-sm">
              <Truck className="h-3 w-3" />
              <span>{orderStats?.shipped_count || 0} Shipped</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 text-sm">
              <XCircle className="h-3 w-3" />
              <span>{orderStats?.cancelled_count || 0} Cancelled</span>
            </div>
          </div>
        </div>
      </div>

      {/* Orders by Address */}
      {addressStats.length > 0 && (
        <div className="rounded-lg bg-card shadow-sm">
          <div className="p-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Orders by Delivery Address
            </h2>
          </div>
          <div className="divide-y divide-border">
            {addressStats.map((addrStat) => (
              <div key={addrStat.address_id} className="p-4 flex items-center justify-between hover:bg-muted/30 transition">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    addrStat.address_type === "delivery"
                      ? "bg-blue-100 text-blue-600"
                      : addrStat.address_type === "billing"
                      ? "bg-green-100 text-green-600"
                      : "bg-purple-100 text-purple-600"
                  }`}>
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{addrStat.address_label}</p>
                    {addrStat.address_city && (
                      <p className="text-xs text-muted-foreground">{addrStat.address_city}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-foreground">{addrStat.order_count} orders</p>
                    <p className="text-xs text-muted-foreground">
                      {addrStat.last_order_date
                        ? `Last: ${new Date(addrStat.last_order_date).toLocaleDateString("it-IT", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : ""}
                    </p>
                  </div>
                  <div className="text-right min-w-[100px]">
                    <p className="text-sm font-bold text-emerald-600">{formatCurrency(addrStat.total_spent)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div className="rounded-lg bg-card shadow-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Orders ({orders.length})
          </h2>
          <div className="flex items-center gap-3">
            {/* Address Filter */}
            {customer.addresses && customer.addresses.length > 0 && (
              <select
                value={addressFilter}
                onChange={(e) => handleAddressFilterChange(e.target.value)}
                className="text-sm rounded border border-border bg-background px-3 py-1.5 focus:border-primary focus:outline-none"
              >
                <option value="all">All Addresses</option>
                {customer.addresses.map((addr: Address) => (
                  <option key={addr.address_id} value={addr.address_id}>
                    {addr.label || addr.recipient_name || addr.city || addr.address_id}
                  </option>
                ))}
              </select>
            )}
            {/* Date Filter */}
            <select
              value={dateFilter}
              onChange={(e) => handleDateFilterChange(e.target.value)}
              className="text-sm rounded border border-border bg-background px-3 py-1.5 focus:border-primary focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="30d">Last 30 Days</option>
              <option value="60d">Last 60 Days</option>
              <option value="90d">Last 90 Days</option>
            </select>
            <Link
              href={`${tenantPrefix}/b2b/store/orders/list?customer_id=${customer.customer_id}`}
              className="text-sm text-primary hover:underline"
            >
              View All Orders →
            </Link>
          </div>
        </div>
        {ordersLoading ? (
          <div className="p-8">
            <div className="animate-pulse space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <ShoppingCart className="mx-auto h-10 w-10 mb-2 opacity-50" />
            <p>No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Order ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">
                    Items
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">
                    Status
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
                {orders.slice(0, 10).map((order) => {
                  const statusStyle = getStatusBadge(order.status);
                  const StatusIcon = statusStyle.icon;
                  return (
                    <tr key={order.order_id} className="hover:bg-muted/30 transition">
                      <td className="px-4 py-3">
                        <Link
                          href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                          className="font-mono text-sm text-primary hover:underline"
                        >
                          {order.order_id}
                        </Link>
                        {order.po_reference && (
                          <div className="text-xs text-muted-foreground">
                            PO: {order.po_reference}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {/* First item thumbnail */}
                          <div className="w-10 h-10 rounded border border-border bg-muted overflow-hidden flex-shrink-0">
                            {order.items?.[0]?.image_url ? (
                              <img
                                src={order.items[0].image_url}
                                alt={order.items[0].name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                                {order.items?.[0]?.sku?.substring(0, 2) || "?"}
                              </div>
                            )}
                          </div>
                          <span className="text-sm text-foreground">
                            {order.items?.length || 0} items
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-medium text-foreground">
                          {formatCurrency(order.order_total)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.bg}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString("it-IT", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${tenantPrefix}/b2b/store/orders/${order.order_id}`}
                          className="flex items-center justify-end gap-1 text-xs text-primary hover:underline font-medium"
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {orders.length > 10 && (
              <div className="p-4 border-t border-border text-center">
                <Link
                  href={`${tenantPrefix}/b2b/store/orders/list?customer_id=${customer.customer_id}`}
                  className="text-sm text-primary hover:underline"
                >
                  View all {orders.length} orders →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Add Address Modal */}
      {showAddAddress && customer && (
        <AddAddressModal
          customerId={customer.customer_id}
          customerName={customer.company_name || [customer.first_name, customer.last_name].filter(Boolean).join(" ")}
          onClose={() => setShowAddAddress(false)}
          onCreated={() => {
            setShowAddAddress(false);
            fetchCustomer();
          }}
        />
      )}
    </div>
  );
}
