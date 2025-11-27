"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface ProductCarouselSettingsProps {
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

export function ProductCarouselSettings({ config, onSave }: ProductCarouselSettingsProps) {
  const [title, setTitle] = useState<string>(config.title || "Featured Products");
  const [searchQuery, setSearchQuery] = useState<string>(config.searchQuery || "");
  const [limit, setLimit] = useState<number>(config.limit || 12);
  const [dataSource, setDataSource] = useState<"search" | "liked" | "trending">(
    config.dataSource || "search"
  );
  const [breakpointMode, setBreakpointMode] = useState<"simplified" | "advanced">(
    config.breakpointMode || "simplified"
  );
  const [itemsToShow, setItemsToShow] = useState({
    desktop: config.itemsToShow?.desktop || 4,
    tablet: config.itemsToShow?.tablet || 3,
    mobile: config.itemsToShow?.mobile || 1
  });
  const [breakpointsJSON, setBreakpointsJSON] = useState(
    JSON.stringify(
      config.breakpointsJSON || {
        "1536": { slidesPerView: 4, spaceBetween: 16 },
        "1280": { slidesPerView: 4, spaceBetween: 16 },
        "1024": { slidesPerView: 3, spaceBetween: 16 },
        "768": { slidesPerView: 2, spaceBetween: 12 },
        "520": { slidesPerView: 1, spaceBetween: 8 },
        "0": { slidesPerView: 1, spaceBetween: 6 }
      },
      null,
      2
    )
  );
  const [autoplay, setAutoplay] = useState<boolean>(config.autoplay ?? false);
  const [autoplaySpeed, setAutoplaySpeed] = useState<number>(config.autoplaySpeed || 5000);
  const [loop, setLoop] = useState<boolean>(config.loop ?? false);
  const [showDots, setShowDots] = useState<boolean>(config.showDots ?? true);
  const [showArrows, setShowArrows] = useState<boolean>(config.showArrows ?? true);

  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Mark as initialized after first render
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Auto-save whenever any setting changes (skip initial mount)
  useEffect(() => {
    if (!isInitialized) return;

    const payload: any = {
      title: title.trim() || 'Featured Products',
      searchQuery: searchQuery.trim(),
      limit: clamp(limit, 1, 50),
      dataSource,
      breakpointMode,
      autoplay,
      autoplaySpeed: clamp(autoplaySpeed, 1000, 20000),
      loop,
      showDots,
      showArrows,
      className: config.className || 'mb-12 xl:mb-14 pt-1'
    };

    if (breakpointMode === 'simplified') {
      payload.itemsToShow = {
        desktop: clamp(Number(itemsToShow.desktop), 1, 6),
        tablet: clamp(Number(itemsToShow.tablet), 1, 6),
        mobile: clamp(Number(itemsToShow.mobile), 1, 4)
      };
    } else {
      try {
        payload.breakpointsJSON = JSON.parse(breakpointsJSON || '{}');
      } catch {
        payload.breakpointsJSON = config.breakpointsJSON || {};
      }
    }

    console.log('[ProductCarouselSettings] Auto-save triggered, title:', payload.title);
    onSave(payload);
  }, [isInitialized, title, searchQuery, limit, dataSource, breakpointMode, autoplay, autoplaySpeed, loop, showDots, showArrows, itemsToShow, breakpointsJSON]);

  const parsedSearchSummary = useMemo(() => {
    if (dataSource !== "search") return null;
    const trimmed = searchQuery.trim();
    if (!/[?=&]/.test(trimmed)) {
      return null;
    }

    try {
      const queryString = trimmed.startsWith("shop?") ? trimmed.slice(5) : trimmed.replace(/^\?/, "");
      const params = new URLSearchParams(queryString);

      const keyword = params.get("text") || "";
      const filters: Array<{ key: string; values: string[] }> = [];

      params.forEach((value, key) => {
        if (key === "text") return;
        const normalizedKey = key.startsWith("filters-") ? key.replace(/^filters-/, "") : key;
        const values = value.split(";").map((item) => item.trim()).filter(Boolean);
        if (values.length) {
          filters.push({ key: normalizedKey, values });
        }
      });

      return {
        keyword,
        filters
      };
    } catch (error) {
      console.warn("[ProductCarouselSettings] Unable to parse search summary", error);
      return null;
    }
  }, [searchQuery, dataSource]);

  useEffect(() => {
    if (dataSource !== "search") {
      setPreviewProducts([]);
      setPreviewError(null);
      setPreviewLoading(false);
      return;
    }

    const trimmed = searchQuery.trim();
    if (!trimmed) {
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
        const params = new URLSearchParams();
        const fetchLimit = Math.min(clamp(limit, 1, 50), 8);
        params.set("limit", String(fetchLimit));

        if (/[?=&]/.test(trimmed)) {
          params.set("query", trimmed);
          try {
            const raw = trimmed.startsWith("shop?") ? trimmed.slice(5) : trimmed;
            const parsed = new URLSearchParams(raw);
            const extractedText = parsed.get("text");
            if (extractedText) {
              params.set("text", extractedText);
            }
          } catch (parseError) {
            console.warn("[ProductCarouselSettings] Unable to parse search query", parseError);
          }
        } else {
          params.set("text", trimmed);
        }

        const response = await fetch(`${PREVIEW_ENDPOINT}?${params.toString()}`, {
          signal: controller.signal
        });
        const data = await response.json();
        if (!response.ok || data?.error) {
          const message =
            typeof data?.error === "string"
              ? data.error
              : `Request failed with status ${response.status}`;
          setPreviewProducts([]);
          setPreviewError(message);
          return;
        }
        setPreviewProducts(Array.isArray(data.items) ? data.items.slice(0, 8) : []);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.error('[ProductCarouselSettings] preview error', error);
          const errorMessage = error instanceof Error ? error.message : 'Unable to load preview results';
          setPreviewError(errorMessage);
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
  }, [searchQuery, limit, dataSource]);


  const previewContent = useMemo(() => {
    if (dataSource !== "search") {
      return <PreviewPlaceholder message="Preview is unavailable for this data source." />;
    }
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
          placeholder="Featured Products"
          className="mt-2"
        />
      </div>

      <div>
        <Label className="text-base font-semibold">Data source</Label>
        <select
          value={dataSource}
          onChange={(event) => setDataSource(event.target.value as "search" | "liked" | "trending")}
          className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-700"
        >
          <option value="search">Keyword / advanced query</option>
          <option value="trending">Trending products</option>
          <option value="liked">Customer liked products</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Use “Trending” or “Liked” for special carousels that load automatically. Keywords are ignored
          for those sources.
        </p>
      </div>

      {dataSource === 'search' ? (
        <div>
          <Label className="text-base font-semibold">Search keyword</Label>
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="e.g. caldaia, climatizzatore, rubinetto"
            className="mt-2"
          />
          <p className="mt-1 text-xs text-slate-500">
            Products are fetched from the customer storefront search endpoint. Paste a keyword or an
            advanced query (e.g. <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">shop?text=lavabo&amp;filters-brand=VUC</code>).
          </p>
          {parsedSearchSummary ? (
            <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {parsedSearchSummary.keyword ? (
                <div className="mb-1">
                  <span className="font-semibold text-slate-700">Keyword:</span>{" "}
                  <span>{parsedSearchSummary.keyword}</span>
                </div>
              ) : null}
              {parsedSearchSummary.filters.length ? (
                <div className="flex flex-wrap gap-2">
                  {parsedSearchSummary.filters.map(({ key, values }) => (
                    <div key={key} className="flex items-center gap-1 rounded bg-white px-2 py-1">
                      <span className="text-[11px] font-semibold uppercase text-slate-500">{key}</span>
                      <span className="text-[11px] text-slate-600">
                        {values.join(", ")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

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
        <p className="mt-1 text-xs text-slate-500">The preview shows up to 8 results.</p>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <Label className="text-sm font-semibold text-slate-700">Carousel options</Label>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={autoplay}
              onChange={(event) => setAutoplay(event.target.checked)}
            />
            Autoplay
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} />
            Loop slides
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showDots} onChange={(event) => setShowDots(event.target.checked)} />
            Show dots
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArrows}
              onChange={(event) => setShowArrows(event.target.checked)}
            />
            Show arrows
          </label>
        </div>
        {autoplay && (
          <div>
            <Label className="text-xs uppercase tracking-wide text-slate-500">
              Autoplay speed (ms)
            </Label>
            <Input
              type="number"
              min={1000}
              max={20000}
              step={500}
              value={autoplaySpeed}
              onChange={(event) => setAutoplaySpeed(Number(event.target.value))}
              className="mt-2"
            />
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <Label className="text-sm font-semibold text-slate-700">Responsive breakpoints</Label>
        <div className="flex items-center gap-6 text-sm text-slate-600">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === 'simplified'}
              onChange={() => setBreakpointMode('simplified')}
            />
            Simplified
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={breakpointMode === 'advanced'}
              onChange={() => setBreakpointMode('advanced')}
            />
            Advanced (JSON)
          </label>
        </div>

        {breakpointMode === 'simplified' ? (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500">Desktop</Label>
              <Input
                type="number"
                min={1}
                max={6}
                value={itemsToShow.desktop}
                onChange={(event) =>
                  setItemsToShow({ ...itemsToShow, desktop: Number(event.target.value) })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500">Tablet</Label>
              <Input
                type="number"
                min={1}
                max={4}
                value={itemsToShow.tablet}
                onChange={(event) =>
                  setItemsToShow({ ...itemsToShow, tablet: Number(event.target.value) })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wide text-slate-500">Mobile</Label>
              <Input
                type="number"
                min={1}
                max={3}
                value={itemsToShow.mobile}
                onChange={(event) =>
                  setItemsToShow({ ...itemsToShow, mobile: Number(event.target.value) })
                }
                className="mt-1"
              />
            </div>
          </div>
        ) : (
          <textarea
            value={breakpointsJSON}
            onChange={(event) => setBreakpointsJSON(event.target.value)}
            rows={8}
            className="mt-2 w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
          />
        )}
      </div>

    </div>
  );
}
