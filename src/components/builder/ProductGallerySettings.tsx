"use client";

import { useEffect, useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ProductSearchPreview, type SearchPreviewProduct } from "@/components/shared/ProductSearchPreview";

interface ProductGallerySettingsProps {
  blockId: string;
  config: any;
  onSave: (config: any) => void;
}

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export function ProductGallerySettings({ config, onSave }: ProductGallerySettingsProps) {
  // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const [title, setTitle] = useState<string>(config.title || "Product Gallery");
  const [searchQuery, setSearchQuery] = useState<string>(config.searchQuery || "");
  const [limit, setLimit] = useState<number>(config.limit || 12);
  const [columns, setColumns] = useState({
    desktop: config.columns?.desktop || 4,
    tablet: config.columns?.tablet || 2,
    mobile: config.columns?.mobile || 1
  });
  const [gap, setGap] = useState<number>(config.gap ?? 16);
  const [showPrice, setShowPrice] = useState<boolean>(config.showPrice ?? true);
  const [showBadge, setShowBadge] = useState<boolean>(config.showBadge ?? true);
  const [showAddToCart, setShowAddToCart] = useState<boolean>(config.showAddToCart ?? false);

  const [cachedProducts, setCachedProducts] = useState<SearchPreviewProduct[]>([]);

  // Track if this is the initial mount to avoid triggering onSave on first render
  const isInitialMount = useRef(true);

  // Auto-sync settings to parent whenever they change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const payload = {
      title: title.trim() || 'Product Gallery',
      searchQuery: searchQuery.trim(),
      limit: clamp(limit, 1, 50),
      columns: {
        desktop: clamp(Number(columns.desktop), 1, 6),
        tablet: clamp(Number(columns.tablet), 1, 4),
        mobile: clamp(Number(columns.mobile), 1, 3)
      },
      gap: clamp(Number(gap), 0, 64),
      showPrice,
      showBadge,
      showAddToCart,
      className: config.className || 'mb-12 xl:mb-14 pt-1'
    };

    onSaveRef.current(payload);
  }, [title, searchQuery, limit, columns.desktop, columns.tablet, columns.mobile, gap, showPrice, showBadge, showAddToCart, config.className]);

  return (
    <div className="space-y-6">
      <div>
        <Label className="text-base font-semibold">Section title</Label>
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Product Gallery"
          className="mt-2"
        />
      </div>

      <ProductSearchPreview
        searchQuery={searchQuery}
        limit={limit}
        cachedProducts={cachedProducts}
        onSearchChange={setSearchQuery}
        onLimitChange={setLimit}
        onProductsLoaded={setCachedProducts}
      />

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Desktop columns</Label>
          <Input
            type="number"
            min={1}
            max={6}
            value={columns.desktop}
            onChange={(event) => setColumns({ ...columns, desktop: Number(event.target.value) })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Tablet columns</Label>
          <Input
            type="number"
            min={1}
            max={4}
            value={columns.tablet}
            onChange={(event) => setColumns({ ...columns, tablet: Number(event.target.value) })}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-500">Mobile columns</Label>
          <Input
            type="number"
            min={1}
            max={3}
            value={columns.mobile}
            onChange={(event) => setColumns({ ...columns, mobile: Number(event.target.value) })}
            className="mt-1"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wide text-slate-500">Grid gap (px)</Label>
        <Input
          type="number"
          min={0}
          max={64}
          value={gap}
          onChange={(event) => setGap(Number(event.target.value))}
          className="mt-1"
        />
      </div>

      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Label className="text-sm font-semibold text-slate-700">Display options</Label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showPrice} onChange={(event) => setShowPrice(event.target.checked)} />
          Show price
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={showBadge} onChange={(event) => setShowBadge(event.target.checked)} />
          Show badge
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={showAddToCart}
            onChange={(event) => setShowAddToCart(event.target.checked)}
          />
          Show add to cart button
        </label>
      </div>
    </div>
  );
}
