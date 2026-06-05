"use client";

import { useState } from "react";
import { Upload, Link as LinkIcon, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { MediaElement } from "@/lib/types/dynamic-blocks";

interface MediaInputProps {
  entityCode: string;
  kind: "image" | "video" | "3d";
  value: MediaElement["media"] | undefined;
  onChange: (media: MediaElement["media"]) => void;
  disabled?: boolean;
}

const ACCEPT_BY_KIND: Record<MediaInputProps["kind"], string> = {
  image: "image/jpeg,image/jpg,image/png,image/webp,image/gif",
  video: "video/mp4,video/webm",
  "3d": ".glb,.gltf",
};

export function MediaInput({ entityCode, kind, value, onChange, disabled }: MediaInputProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("media", file);
      const res = await fetch(`/api/b2b/pim/products/${entityCode}/blocks/media`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "upload failed");
      }
      const data = await res.json();
      onChange({
        url: data.url,
        cdn_key: data.cdn_key,
        is_external_link: data.is_external_link ?? false,
        alt: value?.alt,
      });
      toast.success(t("pages.pim.dynamicBlocks.uploadSuccess"));
    } catch (error) {
      console.error("Block media upload failed:", error);
      toast.error(t("pages.pim.dynamicBlocks.uploadError"));
    } finally {
      setUploading(false);
    }
  }

  function handleAddUrl() {
    const url = urlDraft.trim();
    if (!url) return;
    onChange({ url, is_external_link: true, alt: value?.alt });
    setUrlDraft("");
  }

  function handleClear() {
    onChange({ url: "", alt: value?.alt });
  }

  return (
    <div className="space-y-2">
      {value?.url ? (
        <div className="flex items-center gap-2 rounded border border-border bg-muted/40 p-2">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value.url} alt={value.alt || ""} className="h-12 w-12 rounded object-cover" />
          ) : (
            <LinkIcon className="h-5 w-5 text-muted-foreground" />
          )}
          <span className="flex-1 truncate text-xs text-muted-foreground" title={value.url}>
            {value.url}
          </span>
          {value.is_external_link && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
              {t("pages.pim.dynamicBlocks.external")}
            </span>
          )}
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
            title={t("pages.pim.dynamicBlocks.removeMedia")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label
            className={`inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 ${
              uploading || disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
            }`}
          >
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            {uploading ? t("pages.pim.dynamicBlocks.uploading") : t("pages.pim.dynamicBlocks.upload")}
            <input
              type="file"
              accept={ACCEPT_BY_KIND[kind]}
              onChange={handleFile}
              disabled={uploading || disabled}
              className="hidden"
            />
          </label>
          <div className="flex flex-1 items-center gap-2">
            <input
              type="url"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder={t("pages.pim.dynamicBlocks.urlPlaceholder")}
              disabled={disabled}
              className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={handleAddUrl}
              disabled={disabled || !urlDraft.trim()}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
            >
              <LinkIcon className="h-3 w-3" />
              {t("pages.pim.dynamicBlocks.useUrl")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
