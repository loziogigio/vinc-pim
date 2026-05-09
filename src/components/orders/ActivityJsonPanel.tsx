"use client";

import { useMemo, useState } from "react";
import { Copy, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface ActivityJsonPanelProps {
  label: string;
  value: unknown;
  /** "request" | "response" | "raw" — for test hooks and styling. */
  variant?: "request" | "response" | "raw";
}

function formatJson(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function ActivityJsonPanel({
  label,
  value,
  variant = "request",
}: ActivityJsonPanelProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => formatJson(value), [value]);
  const isEmpty = !text;

  const accent =
    variant === "request"
      ? "border-sky-200 bg-sky-50/60"
      : variant === "response"
        ? "border-emerald-200 bg-emerald-50/60"
        : "border-border bg-muted/40";

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Silent — clipboard write may fail in insecure contexts.
    }
  }

  return (
    <div className={`rounded-md border ${accent}`}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        {!isEmpty && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t("pages.store.orderActivity.copy")}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                {t("pages.store.orderActivity.copied")}
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                {t("pages.store.orderActivity.copy")}
              </>
            )}
          </button>
        )}
      </div>
      {isEmpty ? (
        <div className="px-3 py-2 text-xs text-muted-foreground italic">
          {t("pages.store.orderActivity.empty")}
        </div>
      ) : (
        <pre className="overflow-x-auto px-3 py-2 text-xs font-mono leading-relaxed text-foreground">
          {text}
        </pre>
      )}
    </div>
  );
}
