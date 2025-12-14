"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProductGallerySettingsProps {
  blockId: string;
  config: any;
  onSave: (config: any) => void;
}

const PREVIEW_ENDPOINT = '/api/customer-web/product-search';

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const PreviewPlaceholder = ({ message }: { message: string }) => (
  <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
    {message}
  </div>
);

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

  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    const text = searchQuery.trim();
    if (!text) {
      setPreviewProducts([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setPreviewLoading(true);
        setPreviewError(null);
        const response = await fetch(
          `${PREVIEW_ENDPOINT}?text=${encodeURIComponent(text)}&limit=${Math.min(clamp(limit, 1, 50), 8)}`,
          { signal: controller.signal }
        );
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();
        setPreviewProducts(Array.isArray(data.items) ? data.items.slice(0, 8) : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[ProductGallerySettings] preview error', error);
          setPreviewError('Unable to load preview results');
          setPreviewProducts([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setPreviewLoading(false);
        }
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, limit]);

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

  const previewContent = useMemo(() => {
    if (!searchQuery.trim()) {
      return <PreviewPlaceholder message="Type a keyword above to preview matching products." />;
    }
    if (previewLoading) {
      return <PreviewPlaceholder message="Loading preview results..." />;
    }
    if (previewError) {
      return <PreviewPlaceholder message={previewError} />;
    }
    if (!previewProducts.length) {
      return <PreviewPlaceholder message="No products found for this search." />;
    }

    return (
      <div className="max-h-56 overflow-y-auto rounded-md border border-slate-200 bg-white">
        {previewProducts.map((product: any) => (
          <div
            key={product.id || product.sku}
            className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-b-0"
          >
            {product?.image?.thumbnail ? (
              <img
                src={product.image.thumbnail}
                alt={product.name}
                className="h-12 w-12 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded bg-slate-100 text-xs text-slate-500">
                No image
              </div>
            )}
            <div className="flex flex-1 flex-col">
              <span className="text-sm font-medium text-slate-700">{product.name ?? product.sku}</span>
              {product.sku ? (
                <span className="text-xs text-slate-400">SKU: {product.sku}</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  }, [previewProducts, previewLoading, previewError, searchQuery]);

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

      <div>
        <Label className="text-base font-semibold">Search keyword</Label>
        <Input
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="e.g. rubinetto, caldaia, climatizzatore"
          className="mt-2"
        />
        <p className="mt-1 text-xs text-slate-500">
          The gallery will display products matching this query.
        </p>
      </div>

      <div>
        <Label className="text-base font-semibold">Preview</Label>
        <div className="mt-2">{previewContent}</div>
      </div>

      <div>
        <Label className="text-base font-semibold">Maximum products</Label>
        <Input
          type="number"
          min={1}
          max={50}
          value={limit}
          onChange={(event) => setLimit(Number(event.target.value))}
          className="mt-2"
        />
      </div>

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
