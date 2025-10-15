"use client";

import { Eye, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PageBlock } from "@/lib/types/blocks";
import type { DeviceMode } from "@/lib/store/pageBuilderStore";
import { usePageBuilderStore } from "@/lib/store/pageBuilderStore";

type LivePreviewProps = {
  device: DeviceMode;
  blocks: PageBlock[];
};

export const LivePreview = ({ device, blocks }: LivePreviewProps) => {
  const [previewKey, setPreviewKey] = useState(0);
  const previewTimeoutRef = useRef<NodeJS.Timeout>();
  const getPagePayload = usePageBuilderStore((state) => state.getPagePayload);

  // Auto-save to preview cache with debouncing
  useEffect(() => {
    if (blocks.length === 0) return;

    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    previewTimeoutRef.current = setTimeout(async () => {
      try {
        const state = usePageBuilderStore.getState();
        const currentVersionData = state.versions.length > 0
          ? state.versions[state.versions.length - 1]
          : null;

        const nowISO = new Date().toISOString();

        const previewVersion = {
          version: currentVersionData?.version || 1,
          blocks: state.blocks.map((block, index) => ({
            ...block,
            order: index
          })),
          seo: state.pageDetails.seo,
          status: (currentVersionData?.status || "draft") as "draft" | "published",
          createdAt: currentVersionData?.createdAt || nowISO,
          lastSavedAt: nowISO,
          publishedAt: currentVersionData?.publishedAt,
          createdBy: currentVersionData?.createdBy || "admin",
          comment: currentVersionData?.comment || "Preview version"
        };

        const payload = {
          slug: "home",
          name: "Homepage",
          versions: currentVersionData
            ? [...state.versions.slice(0, -1), previewVersion]
            : [previewVersion],
          currentVersion: state.currentVersion || 1,
          currentPublishedVersion: state.currentPublishedVersion,
          createdAt: state.pageDetails.createdAt || nowISO,
          updatedAt: nowISO
        };

        await fetch("/api/pages/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        setPreviewKey((prev) => prev + 1);
      } catch (err) {
        console.error("Failed to update live preview:", err);
      }
    }, 500);

    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, [blocks, getPagePayload]);

  const handleRefresh = () => {
    setPreviewKey((prev) => prev + 1);
  };

  // Get device-specific width
  const deviceWidth = useMemo(() => {
    switch (device) {
      case "mobile":
        return "375px"; // iPhone SE
      case "tablet":
        return "768px"; // iPad
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
      <div className="flex items-center justify-between rounded-t-xl bg-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Live Preview</span>
          <span className="text-xs text-slate-500">· {deviceLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Updates automatically</span>
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-lg p-1.5 text-slate-600 transition hover:bg-slate-300"
            title="Refresh preview"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-b-xl bg-slate-100 shadow-lg">
        {blocks.length ? (
          <div className="flex h-full items-start justify-center py-4">
            <div
              style={{
                width: deviceWidth,
                maxWidth: "100%"
              }}
              className="h-full transition-all duration-300"
            >
              <iframe
                key={previewKey}
                src={`/preview?slug=home&embed=true&t=${Date.now()}`}
                className="h-full w-full rounded-lg bg-white shadow-md"
                style={{ minHeight: "100%" }}
                title="Live Preview"
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-slate-400">
            <Eye className="h-12 w-12 opacity-60" />
            <p className="text-sm text-slate-500">Preview will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
};
