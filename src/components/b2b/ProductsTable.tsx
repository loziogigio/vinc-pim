"use client";

import { useState } from "react";
import { Sparkles, Image, AlertCircle, MoreVertical, ExternalLink, Paintbrush } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import type { B2BProduct } from "@/lib/types/b2b";

type ProductsTableProps = {
  products: B2BProduct[];
  onEnhance?: (productIds: string[]) => void;
};

const statusConfig = {
  enhanced: {
    label: "Enhanced",
    icon: Sparkles,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  not_enhanced: {
    label: "Not Enhanced",
    icon: AlertCircle,
    className: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-400",
  },
  needs_attention: {
    label: "Needs Attention",
    icon: AlertCircle,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  },
  missing_data: {
    label: "Missing Data",
    icon: AlertCircle,
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
};

export function ProductsTable({ products, onEnhance }: ProductsTableProps) {
  const router = useRouter();
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedProducts(new Set(products.map((p) => p._id)));
    } else {
      setSelectedProducts(new Set());
    }
  };

  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkEnhance = () => {
    if (onEnhance && selectedProducts.size > 0) {
      onEnhance(Array.from(selectedProducts));
    }
  };

  const allSelected = products.length > 0 && selectedProducts.size === products.length;
  const someSelected = selectedProducts.size > 0 && !allSelected;

  return (
    <div className="space-y-2">
      {selectedProducts.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-primary/5 p-2.5">
          <p className="text-xs font-medium">
            {selectedProducts.size} product{selectedProducts.size > 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleBulkEnhance} className="h-7 px-2 text-xs">
              <Sparkles className="mr-1.5 h-3 w-3" />
              Bulk Enhance
            </Button>
            <Button size="sm" variant="outline" onClick={() => setSelectedProducts(new Set())} className="h-7 px-2 text-xs">
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(input) => {
                    if (input) input.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-gray-300"
                />
              </th>
              <th className="p-2 text-left text-xs font-semibold">SKU</th>
              <th className="p-2 text-left text-xs font-semibold">Product</th>
              <th className="p-2 text-left text-xs font-semibold">Category</th>
              <th className="p-2 text-left text-xs font-semibold">Status</th>
              <th className="p-2 text-left text-xs font-semibold">Images</th>
              <th className="p-2 text-left text-xs font-semibold">Last Updated</th>
              <th className="p-2 text-left text-xs font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-6 text-center text-xs text-muted-foreground">
                  No products found
                </td>
              </tr>
            ) : (
              products.map((product) => {
                const status = statusConfig[product.status];
                const StatusIcon = status.icon;
                const isSelected = selectedProducts.has(product._id);

                return (
                  <tr
                    key={product._id}
                    className={`border-b last:border-0 hover:bg-muted/30 ${
                      isSelected ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectProduct(product._id, e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-gray-300"
                      />
                    </td>
                    <td className="p-2">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-mono">
                        {product.sku}
                      </code>
                    </td>
                    <td className="p-2">
                      <p className="text-xs font-medium text-foreground">{product.title}</p>
                      {product.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {product.description}
                        </p>
                      )}
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">{product.category}</td>
                    <td className="p-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}
                      >
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1 text-xs">
                        <Image className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={product.images.length === 0 ? "text-amber-600" : ""}>
                          {product.images.length}
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(product.updatedAt).toLocaleDateString()}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-0.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          title="Open Product Detail Builder"
                          onClick={() => router.push(`/b2b/product-builder?productId=${product.sku}`)}
                        >
                          <Paintbrush className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
