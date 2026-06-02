"use client";

import { Save, Loader2 } from "lucide-react";
import { SectionCard } from "./section-card";
import { useTranslation } from "@/lib/i18n/useTranslation";

const textareaClass =
  "w-full rounded-lg border border-border px-4 py-3 text-sm font-mono text-foreground bg-background focus:border-primary focus:ring-1 focus:ring-primary";

/**
 * Single custom-CSS editor. Shared by the B2B portal and B2C storefront detail
 * pages — the CSS is injected into the storefront <head> as one <style> block.
 */
export function CssSection({
  css,
  onChange,
  saving,
  onSave,
}: {
  css: string;
  onChange: (css: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <SectionCard
        title={t("components.cssSection.title")}
        description={t("components.cssSection.description")}
      >
        <textarea
          value={css}
          onChange={(e) => onChange(e.target.value)}
          rows={18}
          spellCheck={false}
          placeholder={t("components.cssSection.placeholder")}
          className={textareaClass}
        />
        <p className="text-xs text-muted-foreground">
          {t("components.cssSection.hint")}
        </p>
      </SectionCard>

      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving
            ? t("components.cssSection.saving")
            : t("components.cssSection.save")}
        </button>
      </div>
    </div>
  );
}
