"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Search,
  X,
  Package,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Loader2,
  ShoppingCart,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { usePathname } from "next/navigation";
import Link from "next/link";

type Promotion = {
  promo_code?: string;
  label?: Record<string, string>;
  is_active?: boolean;
  discount_percentage?: number;
  promo_price?: number;
  start_date?: string;
  end_date?: string;
  min_quantity?: number;
};

type PackagingOption = {
  code: string;
  label?: Record<string, string>;
  qty: number;
  is_default?: boolean;
  min_order_quantity?: number;
  pricing?: {
    list?: number;
    retail?: number;
    sale?: number;
    list_unit?: number;
    retail_unit?: number;
    sale_unit?: number;
  };
  promotions?: Promotion[];
};

type Product = {
  entity_code: string;
  sku: string;
  name: string | Record<string, string>;
  images?: { url: string }[];
  status: string;
  brand?: { name?: Record<string, string>; id?: string };
  category?: { name?: Record<string, string>; id?: string };
  price?: number;
  sale_price?: number;
  currency?: string;
  vat_rate?: number;
  pricing?: {
    list: number;
    retail?: number;
    sale?: number;
    currency: string;
    vat_rate?: number;
  };
  packaging_options?: PackagingOption[];
};

type FilterState = {
  search: string;
  status: string;
  entity_code: string;
  sku: string;
  sku_match: "exact" | "starts" | "includes" | "ends";
  parent_sku: string;
  parent_sku_match: "exact" | "starts" | "includes" | "ends";
  brand: string;
  category: string;
};

type SelectedItem = {
  product: Product;
  quantity: number;
  unitPrice: number;
  listPrice: number;
  packagingCode?: string;
  packagingLabel?: string;
  packSize?: number;
  minOrderQuantity?: number;
  promoCode?: string;
  promoLabel?: string;
};

// Expanded row type: packaging + optional promotion
type ExpandedRow = {
  pkg?: PackagingOption;
  promo?: Promotion;
  isPromoRow: boolean;
};

// Key for selectedItems map: entityCode:packagingCode:promoIdentifier
// promoIdentifier should be promo_code if available, or a fallback like "promo-{index}"
const getItemKey = (entityCode: string, packagingCode?: string, promoIdentifier?: string): string => {
  let key = entityCode;
  if (packagingCode) key += `:${packagingCode}`;
  if (promoIdentifier) key += `:${promoIdentifier}`;
  return key;
};

// Existing cart item info for pre-populating and updating
type CartItemInfo = {
  entity_code: string;
  packaging_code?: string;
  promo_code?: string;
  promo_row?: number;
  line_number: number;
  quantity: number;
  unit_price: number;
};

interface AddItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  /** @deprecated Use existingCartItems instead for proper packaging-level tracking */
  excludeEntityCodes?: string[];
  /** Items already in cart - allows updating quantities */
  existingCartItems?: CartItemInfo[];
  onItemsAdded?: () => void;
}

export function AddItemsModal({
  isOpen,
  onClose,
  orderId,
  excludeEntityCodes = [],
  existingCartItems = [],
  onItemsAdded,
}: AddItemsModalProps) {
  const pathname = usePathname();
  const tenantMatch = pathname?.match(/^\/([^/]+)\/b2b/);
  const tenantPrefix = tenantMatch ? `/${tenantMatch[1]}` : "";

  const { languages } = useLanguageStore();
  const defaultLanguage =
    languages.find((lang) => lang.isDefault) ||
    languages.find((lang) => lang.code === "it");
  const defaultLanguageCode = defaultLanguage?.code || "it";

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState<Map<string, SelectedItem>>(
    new Map()
  );
  const [totalProducts, setTotalProducts] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const totalPages = Math.ceil(totalProducts / pageSize);

  // Expand/collapse state for product packaging rows
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  // Toggle a single product's expansion
  const toggleProductExpanded = (entityCode: string) => {
    setExpandedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(entityCode)) {
        newSet.delete(entityCode);
      } else {
        newSet.add(entityCode);
      }
      return newSet;
    });
  };

  // Toggle all products expanded/collapsed
  const toggleAllExpanded = () => {
    if (allExpanded) {
      // Collapse all
      setExpandedProducts(new Set());
      setAllExpanded(false);
    } else {
      // Expand all products with multiple packaging rows
      const productsWithMultipleRows = products
        .filter((p) => expandPackagingRows(p).length > 1)
        .map((p) => p.entity_code);
      setExpandedProducts(new Set(productsWithMultipleRows));
      setAllExpanded(true);
    }
  };

  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "published",
    entity_code: "",
    sku: "",
    sku_match: "exact",
    parent_sku: "",
    parent_sku_match: "exact",
    brand: "",
    category: "",
  });

  // Map existing cart items by entity_code:packaging_code:promo_code for quick lookup
  const cartItemsMap = useMemo(() => {
    const map = new Map<string, CartItemInfo>();
    for (const item of existingCartItems) {
      // Include promo_code in key to differentiate regular vs promo items
      const key = `${item.entity_code}:${item.packaging_code || ''}:${item.promo_code || ''}`;
      map.set(key, item);
    }
    return map;
  }, [existingCartItems]);

  // Helper to check if a specific packaging+promo is in cart
  const getCartItem = (entityCode: string, packagingCode?: string, promoCode?: string): CartItemInfo | undefined => {
    const key = `${entityCode}:${packagingCode || ''}:${promoCode || ''}`;
    return cartItemsMap.get(key);
  };

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFilters({
        search: "",
        status: "published",
        entity_code: "",
        sku: "",
        sku_match: "exact",
        parent_sku: "",
        parent_sku_match: "exact",
        brand: "",
        category: "",
      });
      setProducts([]);
      setSelectedItems(new Map());
      setTotalProducts(0);
      setShowAdvancedFilters(false);
      setCurrentPage(1);
      setPageSize(20);
      setExpandedProducts(new Set());
      setAllExpanded(false);
    }
  }, [isOpen]);

  // Build query params from filters
  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", currentPage.toString());
    params.set("limit", pageSize.toString());

    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.status) params.set("status", filters.status);
    if (filters.entity_code) params.set("entity_code", filters.entity_code);
    if (filters.sku) {
      params.set("sku", filters.sku);
      params.set("sku_match", filters.sku_match);
    }
    if (filters.parent_sku) {
      params.set("parent_sku", filters.parent_sku);
      params.set("parent_sku_match", filters.parent_sku_match);
    }
    if (filters.brand) params.set("brand", filters.brand);
    if (filters.category) params.set("category", filters.category);

    return params;
  }, [filters, currentPage, pageSize]);

  // Check if any filter is active
  const hasActiveFilters =
    filters.search.length >= 2 ||
    filters.entity_code ||
    filters.sku ||
    filters.parent_sku ||
    filters.brand ||
    filters.category;

  // Search products with pagination
  const searchProducts = useCallback(async () => {
    if (!hasActiveFilters) {
      setProducts([]);
      setTotalProducts(0);
      return;
    }

    setLoading(true);
    try {
      const params = buildQueryParams();
      const res = await fetch(`/api/b2b/pim/products?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setTotalProducts(data.pagination?.total || data.products?.length || 0);
      }
    } catch (error) {
      console.error("Failed to search products:", error);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, hasActiveFilters]);

  // Update filters with debounce for search - resets to page 1
  const updateFilters = (updates: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...updates }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  // Effect to trigger search when filters change (debounced)
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (hasActiveFilters) {
      searchTimeoutRef.current = setTimeout(() => {
        searchProducts();
      }, 300);
    } else {
      setProducts([]);
      setTotalProducts(0);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters, hasActiveFilters]);

  // Effect to refetch when pagination changes (immediate, no debounce)
  useEffect(() => {
    if (hasActiveFilters) {
      searchProducts();
    }
  }, [currentPage, pageSize]);

  // Reset expanded state when products change (new search results)
  useEffect(() => {
    setExpandedProducts(new Set());
    setAllExpanded(false);
  }, [products]);

  // Handle Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && hasActiveFilters) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchProducts();
    }
  };

  // Get localized packaging label
  const getPackagingLabel = (pkg: PackagingOption): string => {
    if (!pkg.label) return pkg.code;
    return (
      pkg.label[defaultLanguageCode] ||
      pkg.label.it ||
      pkg.label.en ||
      Object.values(pkg.label)[0] ||
      pkg.code
    );
  };

  // Get default packaging or first option
  const getDefaultPackaging = (product: Product): PackagingOption | undefined => {
    if (!product.packaging_options?.length) return undefined;
    return (
      product.packaging_options.find((p) => p.is_default) ||
      product.packaging_options[0]
    );
  };

  // Get active promotion for a packaging option
  const getActivePromotion = (pkg?: PackagingOption): Promotion | undefined => {
    if (!pkg?.promotions?.length) return undefined;
    const now = new Date();
    return pkg.promotions.find((promo) => {
      if (promo.is_active === false) return false;
      if (promo.start_date && new Date(promo.start_date) > now) return false;
      if (promo.end_date && new Date(promo.end_date) < now) return false;
      return promo.promo_price !== undefined && promo.promo_price > 0;
    });
  };

  // Get unit price from a packaging option (returns undefined if no pricing)
  const getPackagingUnitPrice = (pkg: PackagingOption): number | undefined => {
    // Check for active promotion price first
    const activePromo = getActivePromotion(pkg);
    if (activePromo?.promo_price !== undefined) {
      return activePromo.promo_price;
    }
    // Fall back to regular pricing
    if (pkg.pricing) {
      // Prefer unit prices (per-piece), fall back to packaging prices divided by qty
      if (pkg.pricing.sale_unit !== undefined) return pkg.pricing.sale_unit;
      if (pkg.pricing.list_unit !== undefined) return pkg.pricing.list_unit;
      // Fallback: divide packaging price by qty to get unit price
      if (pkg.pricing.sale !== undefined) return pkg.pricing.sale / (pkg.qty || 1);
      if (pkg.pricing.list !== undefined) return pkg.pricing.list / (pkg.qty || 1);
    }
    return undefined;
  };

  // Get product UNIT price for a specific packaging (per-piece price, not packaging total)
  // Priority: promo_price > sale_unit > list_unit > fallbacks > other packaging pricing
  const getProductPrice = (product: Product, packagingCode?: string): number => {
    // If packaging specified, try to get UNIT price from that packaging first
    if (packagingCode && product.packaging_options?.length) {
      const pkg = product.packaging_options.find((p) => p.code === packagingCode);
      if (pkg) {
        const pkgPrice = getPackagingUnitPrice(pkg);
        if (pkgPrice !== undefined) return pkgPrice;
      }
    }

    // If packaging doesn't have its own pricing, try default packaging
    if (product.packaging_options?.length) {
      const defaultPkg = product.packaging_options.find((p) => p.is_default);
      if (defaultPkg) {
        const defaultPrice = getPackagingUnitPrice(defaultPkg);
        if (defaultPrice !== undefined) return defaultPrice;
      }
      // Try first packaging with pricing
      for (const pkg of product.packaging_options) {
        const pkgPrice = getPackagingUnitPrice(pkg);
        if (pkgPrice !== undefined) return pkgPrice;
      }
    }

    // Fall back to product-level pricing
    if (product.pricing) {
      return product.pricing.sale ?? product.pricing.list ?? 0;
    }
    return product.sale_price || product.price || 0;
  };

  // Get list unit price from a packaging option (returns undefined if no pricing)
  const getPackagingListPrice = (pkg: PackagingOption): number | undefined => {
    if (pkg.pricing) {
      if (pkg.pricing.list_unit !== undefined) return pkg.pricing.list_unit;
      if (pkg.pricing.list !== undefined) return pkg.pricing.list / (pkg.qty || 1);
    }
    return undefined;
  };

  // Get list UNIT price for a specific packaging (per-piece price)
  const getListPrice = (product: Product, packagingCode?: string): number => {
    // If packaging specified, try to get UNIT price from that packaging first
    if (packagingCode && product.packaging_options?.length) {
      const pkg = product.packaging_options.find((p) => p.code === packagingCode);
      if (pkg) {
        const pkgPrice = getPackagingListPrice(pkg);
        if (pkgPrice !== undefined) return pkgPrice;
      }
    }

    // If packaging doesn't have its own list pricing, try default packaging
    if (product.packaging_options?.length) {
      const defaultPkg = product.packaging_options.find((p) => p.is_default);
      if (defaultPkg) {
        const defaultPrice = getPackagingListPrice(defaultPkg);
        if (defaultPrice !== undefined) return defaultPrice;
      }
      // Try first packaging with list pricing
      for (const pkg of product.packaging_options) {
        const pkgPrice = getPackagingListPrice(pkg);
        if (pkgPrice !== undefined) return pkgPrice;
      }
    }

    // Fall back to product-level pricing
    if (product.pricing?.list) {
      return product.pricing.list;
    }
    return product.price || 0;
  };

  // Check if a promotion is currently active
  const isPromoActive = (promo: Promotion): boolean => {
    if (promo.is_active === false) return false;
    const now = new Date();
    if (promo.start_date && new Date(promo.start_date) > now) return false;
    if (promo.end_date && new Date(promo.end_date) < now) return false;
    return true;
  };

  // Expand packaging options into rows (regular + promo rows for each packaging)
  const expandPackagingRows = (product: Product): ExpandedRow[] => {
    const rows: ExpandedRow[] = [];

    if (!product.packaging_options?.length) {
      // No packaging - single row
      rows.push({ pkg: undefined, promo: undefined, isPromoRow: false });
      return rows;
    }

    for (const pkg of product.packaging_options) {
      // Regular price row (no promo)
      rows.push({ pkg, promo: undefined, isPromoRow: false });

      // Add a row for each active promotion
      if (pkg.promotions?.length) {
        for (const promo of pkg.promotions) {
          if (isPromoActive(promo)) {
            rows.push({ pkg, promo, isPromoRow: true });
          }
        }
      }
    }

    return rows;
  };

  // Get price for a packaging with optional promo
  const getRowPrice = (product: Product, pkg?: PackagingOption, promo?: Promotion): number => {
    // If promo with promo_price, use that
    if (promo?.promo_price !== undefined && promo.promo_price > 0) {
      return promo.promo_price;
    }
    // If promo with discount_percentage, calculate
    if (promo?.discount_percentage && pkg?.pricing) {
      const basePrice = pkg.pricing.sale ?? pkg.pricing.list ?? 0;
      const unitBase = basePrice / (pkg.qty || 1);
      return unitBase * (1 - promo.discount_percentage / 100);
    }
    // Regular price
    return getProductPrice(product, pkg?.code);
  };

  // Add or remove item with specific packaging and optional promo
  // promoIdentifier should be passed from the render (promo_code if available, or fallback like "promo-{index}")
  const toggleItem = (product: Product, pkg?: PackagingOption, promo?: Promotion, promoIdentifier?: string) => {
    const key = getItemKey(product.entity_code, pkg?.code, promoIdentifier);
    // Use min_order_quantity if set, otherwise use pack size as minimum (can't order partial boxes)
    const minQty = pkg?.min_order_quantity || pkg?.qty || 1;
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(key)) {
        newMap.delete(key);
      } else {
        newMap.set(key, {
          product,
          quantity: minQty,
          unitPrice: getRowPrice(product, pkg, promo),
          listPrice: getListPrice(product, pkg?.code),
          packagingCode: pkg?.code,
          packagingLabel: pkg ? getPackagingLabel(pkg) : undefined,
          packSize: pkg?.qty,
          minOrderQuantity: minQty,
          promoCode: promo?.promo_code,
          promoLabel: promo?.label?.[defaultLanguageCode] || promo?.label?.it || promo?.promo_code,
        });
      }
      return newMap;
    });
  };

  // Update quantity for selected item (by key)
  const updateQuantity = (key: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(key);
      if (item) {
        newMap.set(key, { ...item, quantity });
      }
      return newMap;
    });
  };

  // Update price for selected item (by key)
  const updatePrice = (key: string, price: number) => {
    if (price < 0) return;
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      const item = newMap.get(key);
      if (item) {
        newMap.set(key, { ...item, unitPrice: price });
      }
      return newMap;
    });
  };

  // Remove item by key
  const removeItem = (key: string) => {
    setSelectedItems((prev) => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
  };

  // Get localized product name
  const getProductName = (product: Product): string => {
    if (typeof product.name === "string") return product.name;
    return (
      product.name?.[defaultLanguageCode] ||
      product.name?.it ||
      product.name?.en ||
      Object.values(product.name)[0] ||
      ""
    );
  };

  // Get localized brand name
  const getBrandName = (product: Product): string => {
    if (!product.brand?.name) return "";
    if (typeof product.brand.name === "string") return product.brand.name;
    return (
      product.brand.name[defaultLanguageCode] ||
      product.brand.name.it ||
      product.brand.name.en ||
      Object.values(product.brand.name)[0] ||
      ""
    );
  };

  // Format currency
  const formatCurrency = (amount: number, currency = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(amount);

  // Helper to check if an item is an update (exists in cart with same packaging+promo)
  const isUpdateItem = (item: SelectedItem): CartItemInfo | undefined => {
    // Check if exact match exists in cart (same packaging + same promo_code)
    return getCartItem(item.product.entity_code, item.packagingCode, item.promoCode);
  };

  // Check if any selected items are updates to existing cart items
  const hasUpdates = useMemo(() => {
    for (const [, item] of selectedItems) {
      if (isUpdateItem(item)) return true;
    }
    return false;
  }, [selectedItems, cartItemsMap]);

  // Count new items vs updates
  const { newItemsCount, updateItemsCount } = useMemo(() => {
    let newCount = 0;
    let updateCount = 0;
    for (const [, item] of selectedItems) {
      if (isUpdateItem(item)) {
        updateCount++;
      } else {
        newCount++;
      }
    }
    return { newItemsCount: newCount, updateItemsCount: updateCount };
  }, [selectedItems, cartItemsMap]);

  // Add/update items in order
  const handleAddItems = async () => {
    if (selectedItems.size === 0) return;

    setIsAdding(true);
    let addedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;

    try {
      // Separate items into updates and additions
      // Promo items are always new additions, even if same packaging exists in cart
      const updates: Array<{ line_number: number; quantity: number; unit_price: number }> = [];
      const additions: Array<{ item: SelectedItem; product: Product }> = [];

      for (const [, item] of selectedItems) {
        const cartItem = isUpdateItem(item);
        if (cartItem) {
          // This is an update to existing cart item (non-promo)
          updates.push({
            line_number: cartItem.line_number,
            quantity: item.quantity,
            unit_price: item.unitPrice,
          });
        } else {
          // This is a new addition
          additions.push({ item, product: item.product });
        }
      }

      // Process updates with batch PATCH
      if (updates.length > 0) {
        try {
          const res = await fetch(`/api/b2b/orders/${orderId}/items`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ items: updates }),
          });

          if (res.ok) {
            updatedCount = updates.length;
          } else {
            errorCount += updates.length;
            const error = await res.json();
            console.error("Failed to update items:", error.error);
          }
        } catch (err) {
          errorCount += updates.length;
          console.error("Error updating items:", err);
        }
      }

      // Process additions with individual POSTs
      for (const { item, product } of additions) {
        const { quantity, unitPrice, listPrice, packagingCode, packagingLabel, packSize, minOrderQuantity, promoCode, promoLabel } = item;
        try {
          const res = await fetch(`/api/b2b/orders/${orderId}/items`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              entity_code: product.entity_code,
              sku: product.sku,
              quantity,
              name: getProductName(product),
              list_price: listPrice,
              unit_price: unitPrice,
              vat_rate: product.pricing?.vat_rate || product.vat_rate || 22,
              product_source: "pim",
              image_url: product.images?.[0]?.url,
              brand: getBrandName(product),
              // Packaging info
              packaging_code: packagingCode,
              packaging_label: packagingLabel,
              pack_size: packSize,
              min_order_quantity: minOrderQuantity,
              // Promo info (if this is a promo item)
              promo_code: promoCode,
              promo_label: promoLabel,
            }),
          });

          if (res.ok) {
            addedCount++;
          } else {
            errorCount++;
            const error = await res.json();
            console.error(`Failed to add ${product.entity_code}:`, error.error);
          }
        } catch (err) {
          errorCount++;
          console.error(`Error adding ${product.entity_code}:`, err);
        }
      }

      // Show success message
      if (addedCount > 0 || updatedCount > 0) {
        const messages: string[] = [];
        if (addedCount > 0) messages.push(`Added ${addedCount}`);
        if (updatedCount > 0) messages.push(`Updated ${updatedCount}`);
        toast.success(`${messages.join(", ")} item${addedCount + updatedCount !== 1 ? "s" : ""}`);
        onItemsAdded?.();
        onClose();
      }

      if (errorCount > 0) {
        toast.error(`Failed to process ${errorCount} item${errorCount !== 1 ? "s" : ""}`);
      }
    } catch (error) {
      console.error("Error processing items:", error);
      toast.error("Failed to add items to order");
    } finally {
      setIsAdding(false);
    }
  };

  // Calculate total for selected items
  const selectedTotal = Array.from(selectedItems.values()).reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-6xl rounded-xl border border-border bg-card shadow-xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Add Items to Order
            </h2>
            <p className="text-sm text-muted-foreground">
              Search and select products to add
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filters */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          {/* Main Search */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                value={filters.search}
                onChange={(e) => updateFilters({ search: e.target.value })}
                onKeyDown={handleKeyDown}
                placeholder="Search products by name, entity code, or SKU..."
                className="w-full pl-12 pr-4 py-3 rounded-lg border border-border bg-background focus:border-primary focus:outline-none text-base"
                autoFocus
              />
            </div>
            {/* Status Filter */}
            <select
              value={filters.status}
              onChange={(e) => updateFilters({ status: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          {/* Advanced Filters Toggle */}
          <button
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Filter className="h-4 w-4" />
            Advanced Filters
            {showAdvancedFilters ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="p-4 border border-border rounded-lg bg-muted/30">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Entity Code
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by entity code"
                    value={filters.entity_code}
                    onChange={(e) => updateFilters({ entity_code: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    SKU
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={filters.sku_match}
                      onChange={(e) =>
                        updateFilters({
                          sku_match: e.target.value as FilterState["sku_match"],
                        })
                      }
                      className="rounded border border-border bg-background px-2 py-2 text-xs"
                    >
                      <option value="exact">Exact</option>
                      <option value="starts">Starts with</option>
                      <option value="includes">Includes</option>
                      <option value="ends">Ends with</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter by SKU"
                      value={filters.sku}
                      onChange={(e) => updateFilters({ sku: e.target.value })}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Parent SKU
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={filters.parent_sku_match}
                      onChange={(e) =>
                        updateFilters({
                          parent_sku_match: e.target.value as FilterState["parent_sku_match"],
                        })
                      }
                      className="rounded border border-border bg-background px-2 py-2 text-xs"
                    >
                      <option value="exact">Exact</option>
                      <option value="starts">Starts with</option>
                      <option value="includes">Includes</option>
                      <option value="ends">Ends with</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Filter by parent SKU"
                      value={filters.parent_sku}
                      onChange={(e) => updateFilters({ parent_sku: e.target.value })}
                      className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Brand
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by brand"
                    value={filters.brand}
                    onChange={(e) => updateFilters({ brand: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted-foreground mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    placeholder="Filter by category"
                    value={filters.category}
                    onChange={(e) => updateFilters({ category: e.target.value })}
                    className="w-full rounded border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Type at least 2 characters to search, or use advanced filters.
          </p>
        </div>

        {/* Results Header with Pagination */}
        {(products.length > 0 || hasActiveFilters) && (
          <div className="px-6 py-2 border-b border-border bg-muted/20 flex items-center justify-between gap-4">
            {/* Left: Results info */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">
                {totalProducts > 0 ? (
                  <>
                    Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalProducts)} of {totalProducts}
                  </>
                ) : (
                  "No results"
                )}
              </span>
              {selectedItems.size > 0 && (
                <span className="text-sm font-medium text-primary">
                  {selectedItems.size} selected • {formatCurrency(selectedTotal)}
                </span>
              )}
            </div>

            {/* Right: Toggle All + Page size + Pagination */}
            <div className="flex items-center gap-3">
              {/* Toggle All Button */}
              {products.some((p) => expandPackagingRows(p).length > 1) && (
                <button
                  onClick={toggleAllExpanded}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded border border-border hover:bg-muted transition"
                  title={allExpanded ? "Collapse all packaging options" : "Expand all packaging options"}
                >
                  {allExpanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Collapse All
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Expand All
                    </>
                  )}
                </button>
              )}

              {/* Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Show:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="rounded border border-border bg-background px-2 py-1 text-sm focus:border-primary focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                    className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="px-3 text-sm">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 rounded border border-border hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-3"></div>
                <span className="text-sm text-muted-foreground">
                  Searching products...
                </span>
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-base font-medium text-foreground mb-1">
                {hasActiveFilters ? "No products found" : "Search for products"}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {hasActiveFilters
                  ? "Try different search terms or filters."
                  : "Enter a product name, entity code, or SKU to find products."}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {products.map((product) => {
                const brandName = getBrandName(product);
                const hasPackaging = product.packaging_options && product.packaging_options.length > 0;

                // Expand packaging into rows (regular + promo rows)
                const expandedRows = expandPackagingRows(product);

                return (
                  <div key={product.entity_code} className="border-b border-border last:border-b-0">
                    {/* Product Header (only for products with multiple rows) */}
                    {expandedRows.length > 1 && (
                      <div
                        onClick={() => toggleProductExpanded(product.entity_code)}
                        className="px-4 py-2 bg-muted/40 border-b border-border flex items-center gap-2 cursor-pointer hover:bg-muted/60 transition"
                      >
                        {/* Expand/Collapse Icon */}
                        <div className="flex-shrink-0 text-muted-foreground">
                          {expandedProducts.has(product.entity_code) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                          {product.images?.[0]?.url ? (
                            <img
                              src={product.images[0].url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm font-medium text-foreground line-clamp-1 hover:text-primary hover:underline"
                          >
                            {getProductName(product)}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            <span className="font-mono">{product.sku}</span>
                            <span className="ml-2 text-muted-foreground/70">
                              • {expandedRows.length} packaging options
                            </span>
                          </div>
                        </div>
                        <Link
                          href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition"
                          title="Open product details"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    )}

                    {/* Expanded Rows (packaging + promo combinations) */}
                    {/* Only show rows if: single row product OR product is expanded */}
                    {(expandedRows.length === 1 || expandedProducts.has(product.entity_code)) && expandedRows.map((row, rowIndex) => {
                      const { pkg, promo, isPromoRow } = row;
                      // Always include rowIndex in promo identifier to guarantee uniqueness
                      // (handles cases with duplicate promo_codes or missing promo_codes)
                      const promoIdentifier = promo ? `${promo.promo_code || 'promo'}-r${rowIndex}` : undefined;
                      const key = getItemKey(product.entity_code, pkg?.code, promoIdentifier);

                      // Check if this specific packaging+promo is in cart
                      // Regular rows match cart items without promo_code
                      // Promo rows match cart items with the same promo_code
                      const cartItem = getCartItem(product.entity_code, pkg?.code, promo?.promo_code);
                      const isInCart = !!cartItem;

                      const selectedItem = selectedItems.get(key);
                      const isSelected = !!selectedItem;

                      // Get pricing info
                      const listPrice = isSelected ? selectedItem.listPrice : getListPrice(product, pkg?.code);
                      const salePrice = isSelected ? selectedItem.unitPrice : getRowPrice(product, pkg, promo);
                      const hasDiscount = listPrice > 0 && salePrice < listPrice;
                      const discountPct = hasDiscount ? Math.round((1 - salePrice / listPrice) * 100) : 0;

                      // Use cart quantity as starting point if in cart, otherwise selected or 0
                      const cartQuantity = cartItem?.quantity || 0;
                      const quantity = isSelected ? selectedItem.quantity : cartQuantity;

                      // Use min_order_quantity if set, otherwise use pack size as minimum
                      const minQty = pkg?.min_order_quantity || pkg?.qty || 1;
                      const step = minQty; // Increment/decrement by minOrderQuantity

                      // For single row, show full product info
                      const showFullInfo = expandedRows.length === 1;

                      return (
                        <div
                          key={key}
                          className={`px-4 py-3 ${
                            isInCart && !isSelected
                              ? "bg-emerald-50/50 border-l-4 border-l-emerald-500"
                              : isSelected
                              ? "bg-primary/5 border-l-4 border-l-primary"
                              : isPromoRow
                              ? "bg-orange-50/50"
                              : rowIndex % 2 === 0
                              ? "bg-background"
                              : "bg-muted/10"
                          } ${expandedRows.length > 1 ? "pl-6 ml-2 border-l-2 border-l-muted/50" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-4">
                            {/* Left: Product/Packaging Info */}
                            <div className="flex items-center gap-3 min-w-0">
                              {/* Product Image (only for single row layout) */}
                              {showFullInfo && (
                                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                                  {product.images?.[0]?.url ? (
                                    <img
                                      src={product.images[0].url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  )}
                                </div>
                              )}

                              {/* Product/Packaging Info */}
                              <div className="min-w-0 flex-1">
                              {showFullInfo && (
                                <>
                                  <div className="flex items-center gap-1.5">
                                    <Link
                                      href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                                      target="_blank"
                                      className="text-sm font-medium text-foreground line-clamp-1 hover:text-primary hover:underline"
                                    >
                                      {getProductName(product)}
                                    </Link>
                                    <Link
                                      href={`${tenantPrefix}/b2b/pim/products/${product.entity_code}`}
                                      target="_blank"
                                      className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition flex-shrink-0"
                                      title="Open product details"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  </div>
                                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="font-mono">{product.sku}</span>
                                    {brandName && <span>• {brandName}</span>}
                                  </div>
                                </>
                              )}
                              {isInCart && !isSelected && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded">
                                  In cart ({cartQuantity})
                                </span>
                              )}
                              </div>
                            </div>

                            {/* Right side: Packaging + Price + Quantity (always same structure) */}
                            <div className="flex items-center gap-4 flex-shrink-0">
                              {/* Packaging Label - fixed width for alignment */}
                              <div className="w-[150px] text-right">
                                {pkg && (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-primary/10 text-primary text-sm font-medium whitespace-nowrap">
                                    <Package className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate max-w-[80px]">{getPackagingLabel(pkg)}</span>
                                    <span className="text-primary/70 flex-shrink-0">({pkg.qty})</span>
                                  </span>
                                )}
                              </div>

                              {/* Price - show packaging price (unit × pack size) */}
                              <div className="w-[140px] text-right">
                                {salePrice > 0 ? (
                                  <>
                                    {/* Promo badge for promo rows */}
                                    {isPromoRow && promo && (
                                      <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 text-[10px] font-medium mb-0.5">
                                        <span>🏷️</span>
                                        <span className="truncate max-w-[70px]">
                                          {promo.promo_code}
                                        </span>
                                      </div>
                                    )}
                                    {hasDiscount && (
                                      <div className="text-xs text-muted-foreground">
                                        <span className="line-through">{formatCurrency(listPrice * (pkg?.qty || 1))}</span>
                                        <span className="ml-1 text-rose-600 font-medium">-{discountPct}%</span>
                                      </div>
                                    )}
                                    <div className={`text-base font-semibold ${isPromoRow ? "text-orange-600" : "text-foreground"}`}>
                                      {formatCurrency(salePrice * (pkg?.qty || 1))}
                                    </div>
                                    {pkg && pkg.qty > 1 && (
                                      <div className="text-xs text-muted-foreground">
                                        {formatCurrency(salePrice)}/pz
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-muted-foreground">—</span>
                                )}
                              </div>

                              {/* Quantity Controls - always shown, even for items in cart */}
                              <div className={`flex items-center border rounded-md overflow-hidden bg-background ${
                                isInCart && !isSelected ? "border-emerald-300" : "border-border"
                              }`}>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentQty = isSelected ? quantity : cartQuantity;
                                    const newQty = currentQty - step;

                                    if (newQty < minQty) {
                                      // If removing below min, remove from selection
                                      if (isSelected) removeItem(key);
                                    } else {
                                      if (isSelected) {
                                        updateQuantity(key, newQty);
                                      } else {
                                        // Start editing cart item with reduced quantity
                                        setSelectedItems((prev) => {
                                          const newMap = new Map(prev);
                                          newMap.set(key, {
                                            product,
                                            quantity: newQty,
                                            unitPrice: cartItem?.unit_price || getRowPrice(product, pkg, promo),
                                            listPrice: getListPrice(product, pkg?.code),
                                            packagingCode: pkg?.code,
                                            packagingLabel: pkg ? getPackagingLabel(pkg) : undefined,
                                            packSize: pkg?.qty,
                                            minOrderQuantity: minQty,
                                            promoCode: promo?.promo_code,
                                            promoLabel: promo?.label?.[defaultLanguageCode] || promo?.label?.it || promo?.promo_code,
                                          });
                                          return newMap;
                                        });
                                      }
                                    }
                                  }}
                                  disabled={!isSelected && !isInCart}
                                  className="p-2 hover:bg-muted disabled:opacity-30 transition"
                                >
                                  <Minus className="h-4 w-4" />
                                </button>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  value={isSelected ? quantity : (isInCart ? cartQuantity : "")}
                                  placeholder={isInCart ? String(cartQuantity) : "0"}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    // Allow empty input while typing
                                    if (val === "" || val === "0") {
                                      if (isSelected) {
                                        removeItem(key);
                                      }
                                      return;
                                    }
                                    const rawQty = parseFloat(val);
                                    if (isNaN(rawQty)) return;
                                    // Round to nearest valid multiple of minQty
                                    const newQty = Math.max(minQty, Math.round(rawQty / minQty) * minQty);
                                    if (isSelected) {
                                      updateQuantity(key, newQty);
                                    } else {
                                      // Add/update item with the new quantity
                                      setSelectedItems((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(key, {
                                          product,
                                          quantity: newQty,
                                          unitPrice: cartItem?.unit_price || getRowPrice(product, pkg, promo),
                                          listPrice: getListPrice(product, pkg?.code),
                                          packagingCode: pkg?.code,
                                          packagingLabel: pkg ? getPackagingLabel(pkg) : undefined,
                                          packSize: pkg?.qty,
                                          minOrderQuantity: minQty,
                                          promoCode: promo?.promo_code,
                                          promoLabel: promo?.label?.[defaultLanguageCode] || promo?.label?.it || promo?.promo_code,
                                        });
                                        return newMap;
                                      });
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className={`w-14 text-center border-x py-2 text-sm font-medium bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 ${
                                    isInCart && !isSelected ? "border-emerald-300 text-emerald-700" : "border-border"
                                  }`}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const currentQty = isSelected ? quantity : cartQuantity;
                                    if (isSelected) {
                                      updateQuantity(key, currentQty + step);
                                    } else if (isInCart) {
                                      // Start editing cart item with increased quantity
                                      setSelectedItems((prev) => {
                                        const newMap = new Map(prev);
                                        newMap.set(key, {
                                          product,
                                          quantity: currentQty + step,
                                          unitPrice: cartItem?.unit_price || getRowPrice(product, pkg, promo),
                                          listPrice: getListPrice(product, pkg?.code),
                                          packagingCode: pkg?.code,
                                          packagingLabel: pkg ? getPackagingLabel(pkg) : undefined,
                                          packSize: pkg?.qty,
                                          minOrderQuantity: minQty,
                                          promoCode: promo?.promo_code,
                                          promoLabel: promo?.label?.[defaultLanguageCode] || promo?.label?.it || promo?.promo_code,
                                        });
                                        return newMap;
                                      });
                                    } else {
                                      // Add new item with minQty
                                      toggleItem(product, pkg, promo, promoIdentifier);
                                    }
                                  }}
                                  className="p-2 hover:bg-muted transition"
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-foreground">
              {selectedItems.size > 0 ? (
                <>
                  {newItemsCount > 0 && <span className="text-primary">{newItemsCount} new</span>}
                  {newItemsCount > 0 && updateItemsCount > 0 && ", "}
                  {updateItemsCount > 0 && <span className="text-emerald-600">{updateItemsCount} update{updateItemsCount !== 1 ? "s" : ""}</span>}
                </>
              ) : (
                "No items selected"
              )}
            </span>
            {selectedItems.size > 0 && (
              <>
                <span className="text-sm font-semibold text-primary">
                  Total: {formatCurrency(selectedTotal)}
                </span>
                <button
                  onClick={() => setSelectedItems(new Map())}
                  className="text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Clear selection
                </button>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-border hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              onClick={handleAddItems}
              disabled={selectedItems.size === 0 || isAdding}
              className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white transition disabled:opacity-50 disabled:cursor-not-allowed ${
                hasUpdates ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primary/90"
              }`}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              {hasUpdates && newItemsCount === 0 ? "Update Cart" : hasUpdates ? "Add & Update" : "Add to Order"}
              {selectedItems.size > 0 && ` (${selectedItems.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
