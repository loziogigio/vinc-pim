"use client";

import { AlertTriangle, Eye, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PageBlock } from "@/lib/types/blocks";
import type { DeviceMode } from "@/lib/store/pageBuilderStore";

type LivePreviewProps = {
  device: DeviceMode;
  blocks: PageBlock[];
  productId?: string; // For product detail preview (e.g., "cr6001")
  pageType?: "home" | "product"; // Type of page being previewed
  pageSlug?: string; // For custom B2C page preview (e.g., "chi-siamo")
  customerWebUrl?: string; // Customer web base URL (e.g., "http://localhost:3000")
  isDirty?: boolean;
};

export const LivePreview = ({
  device,
  blocks,
  productId,
  pageType,
  pageSlug,
  customerWebUrl,
  isDirty = true
}: LivePreviewProps) => {
  const [previewKey, setPreviewKey] = useState(0);

  // Send blocks to preview iframe via postMessage (instant, no DB save)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const previewUrl = useMemo(() => {
    let url;
    if (pageType === "home") {
      url = `${customerWebUrl}?preview=true`;
      if (pageSlug) url += `&page=${pageSlug}`;
    } else if (productId) {
      url = `${customerWebUrl}/products/${productId}?preview=true`;
    } else {
      url = `/preview?slug=home&embed=true`;
    }
    console.log('[LivePreview] Preview URL computed:', url);
    return url;
  }, [productId, pageType, pageSlug, customerWebUrl]);

  useEffect(() => {
    if (blocks.length === 0 || !iframeRef.current?.contentWindow) return;

    const blocksWithPosition = blocks.map((block, index) => ({
      ...block,
      _builderPosition: index + 1,
      _builderIndex: index,
    }));

    const payload = {
      type: 'PREVIEW_UPDATE',
      blocks: blocksWithPosition,
      productId,
      pageSlug,
      timestamp: Date.now(),
      isDirty,
      showPositionIndicators: true,
    } as const;

    // Use '*' — both builder and storefront are trusted; the storefront
    // validates the message type on its side.
    iframeRef.current.contentWindow.postMessage(payload, '*');
  }, [blocks, productId, previewUrl, customerWebUrl, isDirty]);

  // REMOVED: Auto-save to preview cache - not needed with postMessage
  // Preview is now instant via postMessage, only save when user clicks "Save Draft"

  /* Old auto-save code removed:
  useEffect(() => {
    if (blocks.length === 0) return;

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Auto-save removed - using postMessage instead
    */

  const handleRefresh = () => {
    setPreviewKey((prev) => prev + 1);
  };

  // Get device-specific width
  const deviceWidth = useMemo(() => {
    switch (device) {
      case "mobile":
        return "375px";
      case "tablet":
        return "768px";
      case "desktop":
      default:
        return "100%";
    }
  }, [device]);

  const deviceLabel = useMemo(() => {
    switch (device) {
      case "mobile":
        return "Mobile (375px)";
      case "tablet":
        return "Tablet (768px)";
      case "desktop":
      default:
        return "Desktop";
    }
  }, [device]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between rounded-t-[0.428rem] bg-[#e8eaed] px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="text-[1rem] font-medium text-[#5e5873]">
            Live Preview - {deviceLabel}
            {productId && <span className="ml-2 text-[0.786rem] text-[#009688]">Product: {productId}</span>}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[0.786rem] text-[#b9b9c3]">Instant preview (no saves)</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex h-7 w-7 items-center justify-center rounded-[5px] text-[#6e6b7b] transition hover:bg-white"
            title="Reload iframe"
          >
            <RefreshCcw className="h-[1.1rem] w-[1.1rem]" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-b-[0.428rem] bg-[#f0f1f5]">
        {!customerWebUrl ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-6 text-[#b9b9c3]">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
            <div className="text-center">
              <p className="text-[0.95rem] font-medium text-[#5e5873]">Shop URL not configured</p>
              <p className="mt-1 text-[0.857rem]">
                Set the <strong>Shop URL</strong> in <strong>Settings → Branding</strong> to enable live preview.
              </p>
              <p className="mt-3 text-[0.75rem] text-[#b9b9c3]">
                Attempted URL: <code className="rounded bg-slate-200 px-1 py-0.5">{previewUrl}</code>
              </p>
            </div>
          </div>
        ) : blocks.length || productId ? (
          <div className="flex h-full items-start justify-center px-6 py-6">
            <div
              style={{
                width: deviceWidth,
                maxWidth: "100%"
              }}
              className="h-full min-h-[480px] overflow-hidden rounded-[0.428rem] border border-[#d8d6de] bg-white shadow-[0_4px_24px_0_rgba(34,41,47,0.08)] transition-all duration-300"
            >
              <iframe
                ref={iframeRef}
                key={previewKey}
                src={previewUrl}
                className="h-full w-full border-0 bg-white"
                style={{ minHeight: "100%" }}
                title="Live Preview"
                allow="clipboard-read; clipboard-write"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 py-6 text-[#b9b9c3]">
            <Eye className="h-12 w-12 opacity-60" />
            <p className="text-[0.857rem]">Preview will appear here once you add blocks.</p>
          </div>
        )}
      </div>
    </div>
  );
};
