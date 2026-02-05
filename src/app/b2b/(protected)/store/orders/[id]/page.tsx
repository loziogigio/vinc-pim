"use client";

import { useEffect, useState, use, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { toast } from "sonner";
import type { Order, LineItem } from "@/lib/types/order";
import type { Customer, Address } from "@/lib/types/customer";

// Simple line editing state (just edit quantity and price of a single line)
interface EditingLineState {
  lineNumber: number;
  name: string;
  sku: string;
  imageUrl?: string;
  packagingLabel?: string;
  packSize: number;
  quantity: number;
  quantityInput: string; // String for input field to allow decimal typing
  unitPrice: number;
  unitPriceInput: string; // String for input field to allow decimal typing
  listPrice: number;
  minOrderQuantity: number;
}
import {
  ShoppingCart,
  Package,
  Trash2,
  Plus,
  Minus,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  ArrowLeft,
  Edit,
  Save,
  X,
  Euro,
  Calendar,
  User,
  FileText,
  MapPin,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Database,
  ExternalLink,
  PenLine,
  Tag,
  MessageSquare,
} from "lucide-react";

// Import lifecycle components
import { StatusActionsCard, QuotationCard, PaymentCard, DeliveryCard, AddItemsModal } from "@/components/orders";
import { ThreadPanel } from "@/components/threads";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  totalItemsCount: number;
  hasSearch: boolean;
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = use(params);
  const router = useRouter();
  const pathname = usePathname();

  // Extract tenant from URL (e.g., /dfl-eventi-it/b2b/store/orders/123 -> dfl-eventi-it)
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<Set<number>>(new Set());

  // Simple line editor state
  const [editingLine, setEditingLine] = useState<EditingLineState | null>(null);

  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  // Customer and address details
  const [customer, setCustomer] = useState<Partial<Customer> | null>(null);
  const [shippingAddress, setShippingAddress] = useState<Address | null>(null);

  // Thread panel visibility
  const [showThread, setShowThread] = useState(false);

  // Add items modal
  const [showAddItemsModal, setShowAddItemsModal] = useState(false);

  // Delete confirmation dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState<{
    open: boolean;
    type: "single" | "multiple";
    lineNumber?: number;
  }>({ open: false, type: "single" });

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  // Fetch order with pagination params
  const fetchOrder = useCallback(async (showFullLoader = true) => {
    if (showFullLoader) {
      setIsLoading(true);
    } else {
      setIsLoadingItems(true);
    }

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
      });
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const res = await fetch(`/api/b2b/orders/${id}?${params}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setPagination(data.pagination);
        setCustomer(data.customer || null);
        setShippingAddress(data.shippingAddress || null);
      } else if (res.status === 404) {
        toast.error("Order not found");
        router.push(`${tenantPrefix}/b2b/store/orders`);
      } else {
        toast.error("Failed to load order");
      }
    } catch (error) {
      console.error("Error fetching order:", error);
      toast.error("Failed to load order");
    } finally {
      setIsLoading(false);
      setIsLoadingItems(false);
    }
  }, [id, currentPage, pageSize, debouncedSearch, router]);

  // Initial load
  useEffect(() => {
    fetchOrder(true);
  }, [id]);

  // Refetch when pagination/search changes (not initial load)
  useEffect(() => {
    if (order) {
      fetchOrder(false);
    }
  }, [currentPage, pageSize, debouncedSearch]);

  // Start editing a line item (simple quantity + price editor)
  function startEditingLine(item: LineItem) {
    setEditingLine({
      lineNumber: item.line_number,
      name: item.name,
      sku: item.sku,
      imageUrl: item.image_url,
      packagingLabel: item.packaging_label || item.packaging_code,
      packSize: item.pack_size || 1,
      quantity: item.quantity,
      quantityInput: String(item.quantity),
      unitPrice: item.unit_price,
      unitPriceInput: String(item.unit_price),
      listPrice: item.list_price,
      minOrderQuantity: item.pack_size || 1, // Can't order partial boxes
    });
  }

  // Update quantity in the editing line (from +/- buttons)
  function updateEditingLineQuantity(quantity: number) {
    if (!editingLine) return;
    const newQty = Math.max(0, quantity);
    setEditingLine({ ...editingLine, quantity: newQty, quantityInput: String(newQty) });
  }

  // Update quantity from input field (allows typing decimals)
  function updateEditingLineQuantityInput(value: string) {
    if (!editingLine) return;
    // Replace comma with dot for decimal
    const normalizedValue = value.replace(",", ".");
    // Allow empty, partial decimals like "1." or just numbers
    if (normalizedValue === "" || /^[0-9]*\.?[0-9]*$/.test(normalizedValue)) {
      const parsed = parseFloat(normalizedValue);
      setEditingLine({
        ...editingLine,
        quantityInput: normalizedValue,
        quantity: isNaN(parsed) ? 0 : parsed,
      });
    }
  }

  // Update price in the editing line (from direct value)
  function updateEditingLinePrice(price: number) {
    if (!editingLine) return;
    const newPrice = Math.max(0, price);
    setEditingLine({ ...editingLine, unitPrice: newPrice, unitPriceInput: String(newPrice) });
  }

  // Update price from input field (allows typing decimals)
  function updateEditingLinePriceInput(value: string) {
    if (!editingLine) return;
    // Replace comma with dot for decimal
    const normalizedValue = value.replace(",", ".");
    // Allow empty, partial decimals like "25." or just numbers
    if (normalizedValue === "" || /^[0-9]*\.?[0-9]*$/.test(normalizedValue)) {
      const parsed = parseFloat(normalizedValue);
      setEditingLine({
        ...editingLine,
        unitPriceInput: normalizedValue,
        unitPrice: isNaN(parsed) ? 0 : parsed,
      });
    }
  }

  // Cancel editing
  function cancelEditingLine() {
    setEditingLine(null);
  }

  // Save line changes (single PATCH)
  async function saveLineChanges() {
    if (!order || !editingLine) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [{
            line_number: editingLine.lineNumber,
            quantity: editingLine.quantity,
            unit_price: editingLine.unitPrice,
          }],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update item");
      }

      toast.success("Item updated");
      setEditingLine(null);
      await fetchOrder(false);
    } catch (error) {
      console.error("Error saving line changes:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmRemoveItem(lineNumber: number) {
    setDeleteConfirmDialog({ open: true, type: "single", lineNumber });
  }

  async function executeRemoveItem(lineNumber: number) {
    if (!order) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_numbers: [lineNumber] }),
      });

      if (res.ok) {
        toast.success("Item removed");
        await fetchOrder(false);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to remove item");
      }
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error("Failed to remove item");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmRemoveSelectedItems() {
    if (!order || selectedForDelete.size === 0) return;
    setDeleteConfirmDialog({ open: true, type: "multiple" });
  }

  async function executeRemoveSelectedItems() {
    if (!order || selectedForDelete.size === 0) return;

    const count = selectedForDelete.size;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/orders/${order.order_id}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ line_numbers: Array.from(selectedForDelete) }),
      });

      if (res.ok) {
        toast.success(`${count} item${count > 1 ? "s" : ""} removed`);
        setSelectedForDelete(new Set());
        await fetchOrder(false);
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to remove items");
      }
    } catch (error) {
      console.error("Error removing items:", error);
      toast.error("Failed to remove items");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteConfirm() {
    setDeleteConfirmDialog({ open: false, type: "single" });
    if (deleteConfirmDialog.type === "single" && deleteConfirmDialog.lineNumber !== undefined) {
      executeRemoveItem(deleteConfirmDialog.lineNumber);
    } else if (deleteConfirmDialog.type === "multiple") {
      executeRemoveSelectedItems();
    }
  }

  function handleDeleteCancel() {
    setDeleteConfirmDialog({ open: false, type: "single" });
  }

  function toggleSelectItem(lineNumber: number) {
    setSelectedForDelete((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lineNumber)) {
        newSet.delete(lineNumber);
      } else {
        newSet.add(lineNumber);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (!order) return;
    const allLineNumbers = order.items?.map((item) => item.line_number) || [];
    if (selectedForDelete.size === allLineNumbers.length) {
      setSelectedForDelete(new Set());
    } else {
      setSelectedForDelete(new Set(allLineNumbers));
    }
  }

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; icon: React.ElementType }> = {
      draft: { bg: "bg-amber-100 text-amber-700", icon: ShoppingCart },
      pending: { bg: "bg-blue-100 text-blue-700", icon: Clock },
      confirmed: { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
      shipped: { bg: "bg-purple-100 text-purple-700", icon: Truck },
      cancelled: { bg: "bg-gray-100 text-gray-700", icon: XCircle },
    };
    return styles[status] || { bg: "bg-gray-100 text-gray-700", icon: ShoppingCart };
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-48 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center">
          <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-lg font-medium">Order not found</p>
          <Link href={`${tenantPrefix}/b2b/store/orders`} className="text-primary hover:underline mt-2 block">
            Back to orders
          </Link>
        </div>
      </div>
    );
  }

  const statusStyle = getStatusBadge(order.status);
  const StatusIcon = statusStyle.icon;
  const isDraft = order.status === "draft";

  // Items are already paginated by the API
  const items = order.items || [];
  const totalItems = pagination?.total || 0;
  const totalPages = pagination?.totalPages || 1;
  const totalItemsCount = pagination?.totalItemsCount || 0;
  const startIndex = (currentPage - 1) * pageSize;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Orders", href: `${tenantPrefix}/b2b/store/orders` },
          { label: `Order ${order.order_id}` },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href={`${tenantPrefix}/b2b/store/orders/list`}
              className="p-2 rounded-lg border border-border hover:bg-muted transition"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground font-mono">
                {order.order_id}
              </h1>
              {order.order_number && (
                <p className="text-sm text-muted-foreground">
                  Order #{order.order_number}/{order.year}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${statusStyle.bg}`}
          >
            <StatusIcon className="h-4 w-4" />
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content - Items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Items */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">
                    Items ({totalItemsCount})
                  </h2>
                  {isLoadingItems && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {order.status === "draft" && selectedForDelete.size > 0 && (
                    <button
                      onClick={confirmRemoveSelectedItems}
                      disabled={isSaving}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete ({selectedForDelete.size})
                    </button>
                  )}
                  {order.status === "draft" && (
                    <button
                      onClick={() => setShowAddItemsModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition"
                    >
                      <Plus className="h-4 w-4" />
                      Add Items
                    </button>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Show:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(Number(e.target.value))}
                      className="text-sm border border-border rounded px-2 py-1 bg-background"
                      disabled={isLoadingItems}
                    >
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Search Filter */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by SKU, entity code, or name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Results count */}
              {debouncedSearch && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Found {totalItems} of {totalItemsCount} items
                </p>
              )}
            </div>

            {items.length > 0 ? (
              <>
                {/* Select All Header (only for draft) */}
                {isDraft && items.length > 1 && (
                  <div className="px-4 py-2 border-b border-border bg-muted/20 flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={selectedForDelete.size === items.length && items.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedForDelete.size > 0
                        ? `${selectedForDelete.size} selected`
                        : "Select all"}
                    </span>
                  </div>
                )}
                <div className={`divide-y divide-border ${isLoadingItems ? "opacity-50" : ""}`}>
                {items.map((item) => {
                  const isEditing = editingLine?.lineNumber === item.line_number;

                  // Inline editing mode for this row
                  if (isEditing && editingLine) {
                    return (
                      <div key={item.line_number} className="p-4 bg-primary/5 border-l-4 border-primary">
                        <div className="flex items-center gap-4">
                          {/* Product Image */}
                          <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                            {editingLine.imageUrl ? (
                              <Image
                                src={editingLine.imageUrl}
                                alt={editingLine.name}
                                width={64}
                                height={64}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
                                #{editingLine.lineNumber}
                              </span>
                              <h3 className="font-semibold text-foreground truncate">{editingLine.name}</h3>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground font-mono">{editingLine.sku}</span>
                              {editingLine.packagingLabel && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-medium">
                                  <Package className="h-3 w-3" />
                                  {editingLine.packagingLabel}
                                  {editingLine.packSize > 1 && ` (${editingLine.packSize} pz)`}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">Quantity</span>
                            <div className="flex items-center border border-border rounded-md overflow-hidden bg-background">
                              <button
                                onClick={() => {
                                  const minQty = editingLine.minOrderQuantity;
                                  const newQty = editingLine.quantity - minQty;
                                  updateEditingLineQuantity(newQty < minQty ? minQty : newQty);
                                }}
                                disabled={editingLine.quantity <= editingLine.minOrderQuantity || isSaving}
                                className="p-2 hover:bg-muted disabled:opacity-30 transition"
                              >
                                <Minus className="h-4 w-4" />
                              </button>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingLine.quantityInput}
                                onChange={(e) => updateEditingLineQuantityInput(e.target.value)}
                                disabled={isSaving}
                                className="w-16 text-center border-x border-border py-2 text-sm font-medium bg-background focus:outline-none disabled:opacity-50"
                              />
                              <button
                                onClick={() => {
                                  updateEditingLineQuantity(editingLine.quantity + editingLine.minOrderQuantity);
                                }}
                                disabled={isSaving}
                                className="p-2 hover:bg-muted transition disabled:opacity-50"
                              >
                                <Plus className="h-4 w-4" />
                              </button>
                            </div>
                          </div>

                          {/* Price Input */}
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs text-muted-foreground">Unit Price</span>
                            <div className="flex items-center border border-border rounded-md overflow-hidden bg-background">
                              <span className="px-2 py-2 text-sm text-muted-foreground bg-muted border-r border-border">€</span>
                              <input
                                type="text"
                                inputMode="decimal"
                                value={editingLine.unitPriceInput}
                                onChange={(e) => updateEditingLinePriceInput(e.target.value)}
                                disabled={isSaving}
                                className="w-20 text-center py-2 text-sm font-medium bg-background focus:outline-none disabled:opacity-50"
                              />
                            </div>
                            {editingLine.listPrice > editingLine.unitPrice && (
                              <span className="text-xs text-muted-foreground line-through">
                                List: €{editingLine.listPrice.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {/* Line Total */}
                          <div className="flex flex-col items-end gap-1 min-w-[100px]">
                            <span className="text-xs text-muted-foreground">Line Total</span>
                            <span className="font-bold text-foreground">
                              {new Intl.NumberFormat("it-IT", {
                                style: "currency",
                                currency: order.currency || "EUR",
                              }).format(editingLine.unitPrice * editingLine.packSize * editingLine.quantity)}
                            </span>
                            {editingLine.packSize > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {editingLine.quantity} × {editingLine.packSize} pz
                              </span>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={cancelEditingLine}
                              className="px-3 py-2 text-sm rounded border border-border hover:bg-muted transition"
                              disabled={isSaving}
                            >
                              <X className="h-4 w-4" />
                            </button>
                            <button
                              onClick={saveLineChanges}
                              disabled={isSaving}
                              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Normal display mode
                  return (
                  <div key={item.line_number} className={`p-4 ${selectedForDelete.has(item.line_number) ? "bg-red-50" : ""}`}>
                    <div className="flex items-start gap-4">
                      {/* Checkbox for delete (only for draft) */}
                      {isDraft && !editingLine && (
                        <div className="pt-4">
                          <input
                            type="checkbox"
                            checked={selectedForDelete.has(item.line_number)}
                            onChange={() => toggleSelectItem(item.line_number)}
                            className="h-4 w-4 rounded border-border text-red-600 focus:ring-red-500 cursor-pointer"
                          />
                        </div>
                      )}
                      {/* Product Image */}
                      <div className="w-16 h-16 rounded overflow-hidden bg-muted flex-shrink-0">
                        {item.image_url ? (
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>

                      {/* Product Details */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground line-clamp-2">
                          {(!item.product_source || item.product_source === "pim") ? (
                            <Link
                              href={`${tenantPrefix}/b2b/pim/products/${item.entity_code}`}
                              className="hover:text-primary hover:underline"
                            >
                              {item.name}
                            </Link>
                          ) : (
                            item.name
                          )}
                        </h3>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          {/* Line Number Badge */}
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                            #{item.line_number}
                          </span>
                          {(!item.product_source || item.product_source === "pim") ? (
                            <Link
                              href={`${tenantPrefix}/b2b/pim/products/${item.entity_code}`}
                              className="font-mono hover:text-primary hover:underline"
                            >
                              SKU: {item.sku}
                            </Link>
                          ) : (
                            <span className="font-mono">SKU: {item.sku}</span>
                          )}
                          {item.brand && <span>Brand: {item.brand}</span>}
                          {/* Product Source Badge */}
                          {item.product_source && item.product_source !== "pim" && (
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                item.product_source === "external"
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                              title={item.external_ref ? `Ref: ${item.external_ref}` : undefined}
                            >
                              {item.product_source === "external" ? (
                                <ExternalLink className="h-2.5 w-2.5" />
                              ) : (
                                <PenLine className="h-2.5 w-2.5" />
                              )}
                              {item.product_source === "external" ? "EXT" : "MAN"}
                            </span>
                          )}
                          {item.product_source === "pim" && (
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700"
                            >
                              <Database className="h-2.5 w-2.5" />
                              PIM
                            </span>
                          )}
                        </div>

                        {/* Packaging & Promo Info */}
                        <div className="mt-1 flex items-center gap-2 text-xs flex-wrap">
                          {/* Packaging */}
                          {(item.packaging_code || item.pack_size) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                              <Package className="h-3 w-3" />
                              {item.packaging_label || item.packaging_code || "Unit"}
                              {item.pack_size && item.pack_size > 1 && (
                                <span className="text-primary/70">
                                  ({item.pack_size} {item.quantity_unit || "pz"})
                                </span>
                              )}
                            </span>
                          )}
                          {/* Promotion */}
                          {item.promo_code && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-100 text-rose-700 font-medium"
                              title={item.promo_label || item.promo_code}
                            >
                              <Tag className="h-3 w-3" />
                              {item.promo_code}
                              {item.promo_discount_pct && (
                                <span className="text-rose-600">
                                  ({item.promo_discount_pct > 0 ? "-" : ""}{Math.abs(item.promo_discount_pct)}%)
                                </span>
                              )}
                              {item.promo_discount_amt && !item.promo_discount_pct && (
                                <span className="text-rose-600">
                                  (-{new Intl.NumberFormat("it-IT", {
                                    style: "currency",
                                    currency: order.currency || "EUR",
                                  }).format(Math.abs(item.promo_discount_amt))})
                                </span>
                              )}
                            </span>
                          )}
                        </div>

                        {/* Price Details */}
                        <div className="mt-2 flex items-center gap-4 text-sm flex-wrap">
                          {/* Retail Price (MSRP) if available */}
                          {item.retail_price && item.retail_price > item.unit_price && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">Retail: </span>
                              <span className="line-through text-muted-foreground">
                                {new Intl.NumberFormat("it-IT", {
                                  style: "currency",
                                  currency: order.currency || "EUR",
                                }).format(item.retail_price)}
                              </span>
                            </div>
                          )}
                          {/* List Price if different from retail */}
                          {item.list_price > item.unit_price && (!item.retail_price || item.list_price !== item.retail_price) && (
                            <div className="text-xs">
                              <span className="text-muted-foreground">List: </span>
                              <span className="line-through text-muted-foreground">
                                {new Intl.NumberFormat("it-IT", {
                                  style: "currency",
                                  currency: order.currency || "EUR",
                                }).format(item.list_price)}
                              </span>
                            </div>
                          )}
                          {/* Unit Price (Net) - with inline editing for draft */}
                          <div className="flex items-center gap-1">
                            <span className="text-muted-foreground">Net: </span>
                            <span className="font-semibold text-foreground">
                              {new Intl.NumberFormat("it-IT", {
                                style: "currency",
                                currency: order.currency || "EUR",
                              }).format(item.unit_price)}
                            </span>
                            {isDraft && !editingLine && (
                              <button
                                onClick={() => startEditingLine(item)}
                                className="p-1 rounded border border-border hover:bg-muted ml-1"
                                title="Edit item"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          {/* Discount Badge - calculated from highest reference price */}
                          {(() => {
                            const refPrice = item.retail_price || item.list_price;
                            const discountPct = refPrice > item.unit_price
                              ? Math.round((1 - item.unit_price / refPrice) * 100)
                              : 0;
                            const savings = refPrice - item.unit_price;
                            return discountPct > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 text-xs font-medium">
                                -{discountPct}%
                                <span className="text-emerald-600 font-normal">
                                  (save {new Intl.NumberFormat("it-IT", {
                                    style: "currency",
                                    currency: order.currency || "EUR",
                                  }).format(savings)})
                                </span>
                              </span>
                            ) : null;
                          })()}
                          {/* Price per smallest unit (per piece) */}
                          {item.pack_size && item.pack_size > 1 && (
                            <div className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              <span className="font-medium">
                                {new Intl.NumberFormat("it-IT", {
                                  style: "currency",
                                  currency: order.currency || "EUR",
                                }).format(item.unit_price / item.pack_size)}
                              </span>
                              <span className="text-amber-600">/{item.quantity_unit || "pz"}</span>
                            </div>
                          )}
                          <div>
                            <span className="text-muted-foreground">VAT: </span>
                            <span>{item.vat_rate}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Actions */}
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            Qty: {item.quantity}
                          </span>
                        </div>

                        {/* Line Total */}
                        <div className="text-right">
                          <div className="font-semibold text-foreground">
                            {new Intl.NumberFormat("it-IT", {
                              style: "currency",
                              currency: order.currency || "EUR",
                            }).format(item.line_total)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Net:{" "}
                            {new Intl.NumberFormat("it-IT", {
                              style: "currency",
                              currency: order.currency || "EUR",
                            }).format(item.line_net)}
                          </div>
                        </div>

                        {/* Remove Button */}
                        {isDraft && !editingLine && (
                          <button
                            onClick={() => confirmRemoveItem(item.line_number)}
                            className="text-red-600 hover:text-red-700 text-xs flex items-center gap-1"
                            disabled={isSaving}
                          >
                            <Trash2 className="h-3 w-3" />
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
              </>
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{debouncedSearch ? "No items match your search" : "No items in this order"}</p>
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-border flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(startIndex + items.length, totalItems)} of {totalItems} items
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || isLoadingItems}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        // Show first, last, current, and adjacent pages
                        return (
                          page === 1 ||
                          page === totalPages ||
                          Math.abs(page - currentPage) <= 1
                        );
                      })
                      .map((page, index, arr) => {
                        // Add ellipsis where there are gaps
                        const prevPage = arr[index - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        return (
                          <span key={page} className="flex items-center">
                            {showEllipsis && (
                              <span className="px-2 text-muted-foreground">...</span>
                            )}
                            <button
                              onClick={() => setCurrentPage(page)}
                              disabled={isLoadingItems}
                              className={`min-w-[32px] h-8 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                currentPage === page
                                  ? "bg-primary text-white"
                                  : "border border-border hover:bg-muted"
                              }`}
                            >
                              {page}
                            </button>
                          </span>
                        );
                      })}
                  </div>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || isLoadingItems}
                    className="p-2 rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {(order.notes || order.internal_notes) && (
            <div className="rounded-lg bg-card shadow-sm border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Notes</h2>
              </div>
              {order.notes && (
                <div className="mb-3">
                  <p className="text-sm text-muted-foreground mb-1">Customer Notes</p>
                  <p className="text-sm text-foreground">{order.notes}</p>
                </div>
              )}
              {order.internal_notes && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Internal Notes</p>
                  <p className="text-sm text-foreground">{order.internal_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar - Summary */}
        <div className="space-y-6">
          {/* Status & Actions Card */}
          <StatusActionsCard
            order={order}
            userRole="admin"
            onStatusChange={() => fetchOrder(false)}
            tenantPrefix={tenantPrefix}
          />

          {/* Quotation Card (only for quotation status) */}
          {order.status === "quotation" && order.quotation && (
            <QuotationCard
              order={order}
              onQuotationChange={() => fetchOrder(false)}
            />
          )}

          {/* Payment Card (for confirmed/shipped/delivered) */}
          <PaymentCard
            order={order}
            onPaymentChange={() => fetchOrder(false)}
          />

          {/* Delivery Card (for shipped/delivered) */}
          <DeliveryCard
            order={order}
            onDeliveryChange={() => fetchOrder(false)}
          />

          {/* Thread/Discussion Button */}
          <div className="rounded-lg bg-card shadow-sm border border-border p-4">
            <button
              onClick={() => setShowThread(!showThread)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition"
            >
              <MessageSquare className="h-4 w-4" />
              {showThread ? "Hide Discussion" : "Show Discussion"}
            </button>
          </div>

          {/* Thread Panel */}
          {showThread && (
            <ThreadPanel
              refType="order"
              refId={order.order_id}
              mode="panel"
              currentUserId="admin"
              currentUserName="Admin"
              currentUserType="admin"
            />
          )}

          {/* Order Summary */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Euro className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Order Summary</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (Gross)</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("it-IT", {
                    style: "currency",
                    currency: order.currency || "EUR",
                  }).format(order.subtotal_gross)}
                </span>
              </div>
              {order.total_discount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-emerald-600">
                    -
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: order.currency || "EUR",
                    }).format(order.total_discount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal (Net)</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("it-IT", {
                    style: "currency",
                    currency: order.currency || "EUR",
                  }).format(order.subtotal_net)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">VAT</span>
                <span className="font-medium">
                  {new Intl.NumberFormat("it-IT", {
                    style: "currency",
                    currency: order.currency || "EUR",
                  }).format(order.total_vat)}
                </span>
              </div>
              {order.shipping_cost > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: order.currency || "EUR",
                    }).format(order.shipping_cost)}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-semibold text-foreground">Total</span>
                  <span className="font-bold text-lg text-foreground">
                    {new Intl.NumberFormat("it-IT", {
                      style: "currency",
                      currency: order.currency || "EUR",
                    }).format(order.order_total)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Customer</h2>
              </div>
              <Link
                href={`${tenantPrefix}/b2b/store/customers/${order.customer_id}`}
                className="text-xs text-primary hover:underline"
              >
                View Profile →
              </Link>
            </div>
            <div className="p-4 space-y-3">
              {/* Customer Identification Codes - Priority: Public Code > ERP Code > Internal ID */}
              <div className="space-y-2 pb-3 border-b border-border">
                {/* Public Customer Code (Primary - most important for administrative purposes) */}
                {customer?.public_code && (
                  <div>
                    <p className="text-xs text-muted-foreground">Public Customer Code</p>
                    <p className="text-sm font-semibold font-mono text-foreground">{customer.public_code}</p>
                  </div>
                )}
                {/* Customer Code from ERP (Secondary) */}
                {(customer?.external_code || order.customer_code) && (
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Code (ERP)</p>
                    <p className="text-sm font-medium font-mono text-muted-foreground">
                      {customer?.external_code || order.customer_code}
                    </p>
                  </div>
                )}
                {/* Internal VINC ID (Tertiary) */}
                <div>
                  <p className="text-xs text-muted-foreground">Customer ID (Internal)</p>
                  <Link
                    href={`${tenantPrefix}/b2b/store/customers/${order.customer_id}`}
                    className="text-xs font-mono text-primary hover:underline"
                  >
                    {order.customer_id}
                  </Link>
                </div>
              </div>
              {/* Customer Details */}
              {customer && (
                <>
                  {customer.company_name && (
                    <div>
                      <p className="text-xs text-muted-foreground">Company</p>
                      <p className="text-sm font-medium">{customer.company_name}</p>
                    </div>
                  )}
                  {(customer.first_name || customer.last_name) && (
                    <div>
                      <p className="text-xs text-muted-foreground">Contact</p>
                      <p className="text-sm font-medium">
                        {[customer.first_name, customer.last_name].filter(Boolean).join(" ")}
                      </p>
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium">{customer.email}</p>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium">{customer.phone}</p>
                    </div>
                  )}
                </>
              )}
              {order.po_reference && (
                <div>
                  <p className="text-xs text-muted-foreground">PO Reference</p>
                  <p className="text-sm font-medium">{order.po_reference}</p>
                </div>
              )}
            </div>
          </div>

          {/* Order Details */}
          <div className="rounded-lg bg-card shadow-sm border border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Details</h2>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {order.tenant_id && (
                <div>
                  <p className="text-xs text-muted-foreground">Tenant</p>
                  <p className="text-sm font-medium font-mono bg-primary/10 text-primary px-2 py-0.5 rounded inline-block">
                    {order.tenant_id}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {new Date(order.created_at).toLocaleString("it-IT", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
              {order.confirmed_at && (
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed</p>
                  <p className="text-sm font-medium">
                    {new Date(order.confirmed_at).toLocaleString("it-IT", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Order Type</p>
                <p className="text-sm font-medium uppercase">{order.order_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price List</p>
                <p className="text-sm font-medium">{order.price_list_id}</p>
              </div>
              {order.source && (
                <div>
                  <p className="text-xs text-muted-foreground">Source</p>
                  <p className="text-sm font-medium capitalize">{order.source}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Info */}
          {(order.shipping_address_id || order.requested_delivery_date || order.shipping_method || shippingAddress) && (
            <div className="rounded-lg bg-card shadow-sm border border-border">
              <div className="p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold text-foreground">Delivery</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                {order.shipping_address_id && (
                  <div>
                    <p className="text-xs text-muted-foreground">Address ID</p>
                    <Link
                      href={`${tenantPrefix}/b2b/store/customers/${order.customer_id}?address=${order.shipping_address_id}`}
                      className="text-sm font-medium font-mono text-primary hover:underline"
                    >
                      {order.shipping_address_id}
                    </Link>
                    {order.shipping_address_code && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Code: {order.shipping_address_code}
                      </p>
                    )}
                  </div>
                )}
                {/* Full Address Details */}
                {shippingAddress && (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {shippingAddress.label || "Shipping Address"}
                      </p>
                      <div className="text-sm font-medium space-y-0.5">
                        <p>{shippingAddress.recipient_name}</p>
                        <p>{shippingAddress.street_address}</p>
                        {shippingAddress.street_address_2 && (
                          <p>{shippingAddress.street_address_2}</p>
                        )}
                        <p>
                          {shippingAddress.postal_code} {shippingAddress.city} ({shippingAddress.province})
                        </p>
                        <p>{shippingAddress.country}</p>
                      </div>
                    </div>
                    {shippingAddress.phone && (
                      <div>
                        <p className="text-xs text-muted-foreground">Phone</p>
                        <p className="text-sm font-medium">{shippingAddress.phone}</p>
                      </div>
                    )}
                    {shippingAddress.delivery_notes && (
                      <div>
                        <p className="text-xs text-muted-foreground">Notes</p>
                        <p className="text-sm text-foreground">{shippingAddress.delivery_notes}</p>
                      </div>
                    )}
                  </>
                )}
                {order.requested_delivery_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Requested Date</p>
                    <p className="text-sm font-medium">
                      {new Date(order.requested_delivery_date).toLocaleDateString("it-IT", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>
                )}
                {order.shipping_method && (
                  <div>
                    <p className="text-xs text-muted-foreground">Shipping Method</p>
                    <p className="text-sm font-medium capitalize">{order.shipping_method}</p>
                  </div>
                )}
                {order.delivery_slot && (
                  <div>
                    <p className="text-xs text-muted-foreground">Delivery Slot</p>
                    <p className="text-sm font-medium capitalize">{order.delivery_slot}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Items Modal */}
      <AddItemsModal
        isOpen={showAddItemsModal}
        onClose={() => setShowAddItemsModal(false)}
        orderId={order.order_id}
        existingCartItems={order.items?.map((item) => ({
          entity_code: item.entity_code,
          packaging_code: item.packaging_code,
          promo_code: item.promo_code,
          promo_row: item.promo_row,
          line_number: item.line_number,
          quantity: item.quantity,
          unit_price: item.unit_price,
        })) || []}
        onItemsAdded={() => fetchOrder(false)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmDialog.open}
        title="Remove Item"
        message={
          deleteConfirmDialog.type === "single"
            ? "Are you sure you want to remove this item from the order?"
            : `Are you sure you want to remove ${selectedForDelete.size} item${selectedForDelete.size > 1 ? "s" : ""} from the order?`
        }
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
