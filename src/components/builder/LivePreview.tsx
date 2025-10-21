"use client";

import { Eye, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PageBlock } from "@/lib/types/blocks";
import type { DeviceMode } from "@/lib/store/pageBuilderStore";

type LivePreviewProps = {
  device: DeviceMode;
  blocks: PageBlock[];
  productId?: string; // For product detail preview (e.g., "cr6001")
  customerWebUrl?: string; // Customer web base URL (e.g., "http://localhost:3000")
  isDirty?: boolean;
};

export const LivePreview = ({
  device,
  blocks,
  productId,
  customerWebUrl = process.env.NEXT_PUBLIC_CUSTOMER_WEB_URL || "http://localhost:3000",
  isDirty = true
}: LivePreviewProps) => {
  const [previewKey, setPreviewKey] = useState(0);

  // Send blocks to preview iframe via postMessage (instant, no DB save)
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    console.log('[LivePreview] useEffect triggered');
    console.log('[LivePreview] Blocks count:', blocks.length);
    console.log('[LivePreview] isDirty:', isDirty);
    console.log('[LivePreview] productId:', productId);
    console.log('[LivePreview] customerWebUrl:', customerWebUrl);
    console.log('[LivePreview] iframeRef exists:', !!iframeRef.current);
    console.log('[LivePreview] contentWindow exists:', !!iframeRef.current?.contentWindow);

    if (blocks.length > 0) {
      console.log('[LivePreview] First block type:', blocks[0].type);
      console.log('[LivePreview] First block config keys:', Object.keys(blocks[0].config || {}));
    }

    // Send blocks to iframe immediately via postMessage
    if (iframeRef.current?.contentWindow) {
      // Try to get the iframe's current location for debugging
      try {
        const iframeLocation = iframeRef.current.contentWindow.location.href;
        console.log('[LivePreview] Iframe current location:', iframeLocation);
      } catch (e) {
        console.log('[LivePreview] Cannot access iframe location (cross-origin)');
      }

      console.log('[LivePreview] ✅ Sending postMessage with', blocks.length, 'blocks');
      console.log('[LivePreview] Target origin:', customerWebUrl);

      try {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'PREVIEW_UPDATE',
            blocks: blocks,
            productId: productId,
            timestamp: Date.now(),
            isDirty
          },
          customerWebUrl // Target origin
        );
        console.log('[LivePreview] ✅ postMessage sent successfully to', customerWebUrl);
      } catch (error) {
        console.error('[LivePreview] ❌ postMessage failed:', error);
      }
    } else {
      console.warn('[LivePreview] ❌ Cannot send postMessage - iframe not ready');
      console.warn('[LivePreview] - iframeRef.current:', !!iframeRef.current);
      console.warn('[LivePreview] - contentWindow:', !!iframeRef.current?.contentWindow);
    }
  }, [blocks, productId, customerWebUrl, isDirty]);

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

  // Determine preview URL (stable - no timestamp to avoid iframe reloads)
  const previewUrl = useMemo(() => {
    let url;
    if (productId) {
      // Show customer_web product detail page
      // Example: http://localhost:3000/it/products/daliakcl?preview=true
      url = `${customerWebUrl}/it/products/${productId}?preview=true`;
    } else {
      // Fallback to internal preview page
      url = `/preview?slug=home&embed=true`;
    }
    console.log('[LivePreview] Preview URL computed:', url);
    return url;
  }, [productId, customerWebUrl]);

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
        {blocks.length || productId ? (
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
