"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ProductSearchPreview, type SearchPreviewProduct } from "@/components/shared/ProductSearchPreview";

type DataSource = "search" | "liked" | "trending" | "reminder";

interface ProductCarouselSettingsProps {
  blockId: string;
  config: any;
  onSave: (config: any) => void;
}

const clamp = (value: number, min: number, max: number) => {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
};

export function ProductCarouselSettings({ config, onSave }: ProductCarouselSettingsProps) {
  const [title, setTitle] = useState<string>(config.title || "Featured Products");
  const [searchQuery, setSearchQuery] = useState<string>(config.searchQuery || "");
  const [limit, setLimit] = useState<number>(config.limit || 12);
  const [dataSource, setDataSource] = useState<DataSource>(config.dataSource || "search");
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

  const [cachedProducts, setCachedProducts] = useState<SearchPreviewProduct[]>([]);
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

    onSave(payload);
  }, [isInitialized, title, searchQuery, limit, dataSource, breakpointMode, autoplay, autoplaySpeed, loop, showDots, showArrows, itemsToShow, breakpointsJSON]);

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
          onChange={(event) => setDataSource(event.target.value as DataSource)}
          className="mt-2 h-10 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-700"
        >
          <option value="search">Keyword / advanced query</option>
          <option value="trending">Trending products</option>
          <option value="liked">Customer liked products</option>
          <option value="reminder">Customer reminded products</option>
        </select>
        <p className="mt-1 text-xs text-slate-500">
          Use &quot;Trending&quot;, &quot;Liked&quot;, or &quot;Reminder&quot; for special carousels
          that load automatically. Keywords are ignored for those sources.
        </p>
      </div>

      {dataSource === 'search' ? (
        <ProductSearchPreview
          searchQuery={searchQuery}
          limit={limit}
          cachedProducts={cachedProducts}
          onSearchChange={setSearchQuery}
          onLimitChange={setLimit}
          onProductsLoaded={setCachedProducts}
        />
      ) : (
        <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
          Products are loaded automatically by the storefront.
        </div>
      )}

      {dataSource !== 'search' ? (
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
      ) : null}

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
