"use client";

import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, ChevronRight, ClipboardPaste, AlertCircle, CheckCircle2, ArrowUp, ArrowDown } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "./section-card";
import type { IB2CCustomScript } from "./types";
import type { ScriptPlacement, ScriptLoadingStrategy } from "@/lib/db/models/b2c-storefront";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-[#009688] focus:ring-1 focus:ring-[#009688]";

const DEFAULT_SCRIPT: IB2CCustomScript = {
  label: "",
  src: "",
  inline_code: "",
  placement: "head",
  loading_strategy: "async",
  enabled: true,
};

// ============================================
// PROVIDER DETECTION
// ============================================

interface ProviderInfo {
  name: string;
  className: string;
}

const PROVIDER_RULES: { test: RegExp; info: ProviderInfo }[] = [
  { test: /iubenda/i, info: { name: "Iubenda", className: "bg-blue-100 text-blue-700" } },
  { test: /google.*analytics|gtag\b/i, info: { name: "Google Analytics", className: "bg-orange-100 text-orange-700" } },
  { test: /tag.?manager|gtm\b/i, info: { name: "GTM", className: "bg-blue-100 text-blue-700" } },
  { test: /facebook|fbq\b/i, info: { name: "Facebook Pixel", className: "bg-indigo-100 text-indigo-700" } },
  { test: /hotjar/i, info: { name: "Hotjar", className: "bg-red-100 text-red-700" } },
  { test: /clarity\.ms|clarity/i, info: { name: "Clarity", className: "bg-teal-100 text-teal-700" } },
  { test: /tiktok/i, info: { name: "TikTok", className: "bg-gray-100 text-gray-700" } },
  { test: /pinterest/i, info: { name: "Pinterest", className: "bg-red-100 text-red-700" } },
  { test: /linkedin/i, info: { name: "LinkedIn", className: "bg-blue-100 text-blue-700" } },
];

function detectProvider(script: IB2CCustomScript): ProviderInfo {
  const text = `${script.label || ""} ${script.src || ""} ${script.inline_code || ""}`;
  for (const rule of PROVIDER_RULES) {
    if (rule.test.test(text)) return rule.info;
  }
  return { name: "Custom", className: "bg-slate-100 text-slate-600" };
}

// ============================================
// SNIPPET PARSER
// ============================================

interface ParsedEntry {
  src?: string;
  inline_code?: string;
  loading_strategy: ScriptLoadingStrategy;
}

/**
 * Parse pasted HTML containing one or more <script> tags.
 * Groups: first external src + following inline blocks as one entry,
 * then each subsequent external src starts a new entry (with its inline followers).
 * Handles snippets with multiple external URLs (e.g. Iubenda).
 *
 * Returns an array of parsed entries + a detected label.
 */
function parseScriptSnippet(raw: string): { entries: ParsedEntry[]; label?: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Match all <script ...>...</script> or self-closing <script ... />
  const scriptRegex = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>|<script\b([^>]*)\/>/gi;
  const matches = [...trimmed.matchAll(scriptRegex)];

  if (matches.length === 0) return null;

  // Parse each <script> into a raw item
  const items: { src?: string; body?: string; strategy: ScriptLoadingStrategy }[] = [];
  for (const match of matches) {
    const attrs = match[1] || match[3] || "";
    const body = (match[2] || "").trim();
    const srcMatch = attrs.match(/src\s*=\s*["']([^"']+)["']/i);

    let strategy: ScriptLoadingStrategy = "async";
    if (/\bdefer\b/i.test(attrs)) strategy = "defer";
    else if (/\basync\b/i.test(attrs)) strategy = "async";
    else if (srcMatch) strategy = "blocking";

    // Normalize protocol-relative URLs (//cdn.example.com → https://cdn.example.com)
    let src = srcMatch?.[1];
    if (src && src.startsWith("//")) src = "https:" + src;

    items.push({
      src,
      body: body || undefined,
      strategy,
    });
  }

  // Group: each external src starts a new entry; inline-only blocks attach to the previous entry
  const entries: ParsedEntry[] = [];
  for (const item of items) {
    if (item.src) {
      // New entry for this external script
      entries.push({
        src: item.src,
        inline_code: item.body,
        loading_strategy: item.strategy,
      });
    } else if (item.body) {
      // Inline block — attach to previous entry or create standalone
      if (entries.length > 0 && !entries[entries.length - 1].inline_code) {
        entries[entries.length - 1].inline_code = item.body;
      } else if (entries.length > 0) {
        entries[entries.length - 1].inline_code += "\n\n" + item.body;
      } else {
        entries.push({
          inline_code: item.body,
          loading_strategy: "async",
        });
      }
    }
  }

  if (entries.length === 0) return null;

  // Detect label from all content combined
  const combined = entries.map(e => `${e.src || ""} ${e.inline_code || ""}`).join(" ");
  let label: string | undefined;
  if (/googletagmanager\.com\/gtag/i.test(combined)) label = "Google Analytics";
  else if (/googletagmanager\.com\/gtm/i.test(combined)) label = "Google Tag Manager";
  else if (/connect\.facebook\.net|fbq\(/i.test(combined)) label = "Facebook Pixel";
  else if (/iubenda/i.test(combined)) label = "Iubenda";
  else if (/hotjar/i.test(combined)) label = "Hotjar";
  else if (/clarity\.ms/i.test(combined)) label = "Microsoft Clarity";
  else if (/tiktok/i.test(combined)) label = "TikTok Pixel";
  else if (/pinterest/i.test(combined)) label = "Pinterest Tag";
  else if (/linkedin/i.test(combined)) label = "LinkedIn Insight";

  return { entries, label };
}

/**
 * Derive a descriptive sub-label for a parsed entry based on its content.
 */
function deriveSubLabel(entry: ParsedEntry): string {
  const src = entry.src || "";
  const code = entry.inline_code || "";

  // Iubenda-specific patterns
  if (/csConfiguration/i.test(code)) return "Config";
  if (/autoblocking/i.test(src)) return "Autoblocking";
  if (/iubenda_cs\.js/i.test(src)) return "CS Loader";
  if (/iubenda_cons\.js/i.test(src)) return "Consent DB";
  if (/\/iubenda\.js/i.test(src) || /\/iubenda\.js/i.test(code)) return "JS Loader";

  // Google patterns
  if (/gtag\/js/i.test(src)) return "Loader";
  if (/gtm\.js/i.test(src)) return "Container";
  if (/dataLayer/i.test(code) && !src) return "Config";

  // Facebook patterns
  if (/fbevents\.js/i.test(src)) return "Loader";
  if (/fbq\(/i.test(code) && !src) return "Config";

  // Fallback: extract filename from URL
  if (src) {
    const filename = src.split("/").pop()?.split("?")[0];
    if (filename) return filename;
  }

  return "Inline";
}

/**
 * Validate a script entry and return issues found.
 */
function validateScript(script: IB2CCustomScript): string[] {
  const issues: string[] = [];
  if (!script.label?.trim()) issues.push("Label is required");
  if (!script.src && !script.inline_code?.trim()) issues.push("URL or inline code is required");
  if (script.src && !script.src.startsWith("https://")) issues.push("URL must start with https://");
  return issues;
}

// ============================================
// SCRIPT ENTRY COMPONENT
// ============================================

function ScriptEntry({
  script,
  index,
  total,
  onChange,
  onRemove,
  onMove,
  onParsedMultiple,
}: {
  script: IB2CCustomScript;
  index: number;
  total: number;
  onChange: (index: number, updated: IB2CCustomScript) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: "up" | "down") => void;
  onParsedMultiple: (index: number, entries: IB2CCustomScript[]) => void;
}) {
  const hasContent = !!script.src || !!script.inline_code?.trim();
  const [expanded, setExpanded] = useState(!hasContent);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPaste, setShowPaste] = useState(!hasContent);
  const [pasteValue, setPasteValue] = useState("");
  const [parseError, setParseError] = useState("");

  const issues = validateScript(script);
  const provider = detectProvider(script);

  function update(partial: Partial<IB2CCustomScript>) {
    onChange(index, { ...script, ...partial });
  }

  function handleParse() {
    setParseError("");
    const result = parseScriptSnippet(pasteValue);
    if (!result) {
      setParseError("Could not find any <script> tags in the pasted content.");
      return;
    }

    const label = script.label || result.label || "";

    if (result.entries.length === 1) {
      const e = result.entries[0];
      update({
        src: e.src || "",
        inline_code: e.inline_code || "",
        loading_strategy: e.loading_strategy,
        label,
      });
    } else {
      const parsed: IB2CCustomScript[] = result.entries.map((e) => ({
        label: `${label} — ${deriveSubLabel(e)}`,
        src: e.src || "",
        inline_code: e.inline_code || "",
        placement: script.placement,
        loading_strategy: e.loading_strategy,
        enabled: true,
      }));
      onParsedMultiple(index, parsed);
    }
    setPasteValue("");
    setShowPaste(false);
  }

  // Summary for collapsed view
  let summary = "No content";
  if (script.src) {
    try { summary = new URL(script.src).hostname.replace(/^www\./, ""); } catch { summary = script.src.slice(0, 40); }
  } else if (script.inline_code?.trim()) {
    summary = `${script.inline_code.slice(0, 50).trim()}…`;
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
      {/* Collapsed Header */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ChevronRight
            className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
          />
        </button>

        {/* Label + Provider Badge */}
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className="text-sm font-medium text-slate-900 truncate">
            {script.label || "Untitled Script"}
          </span>
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${provider.className}`}>
            {provider.name}
          </span>
          {!expanded && (
            <span className="text-xs text-slate-400 truncate hidden sm:inline">
              {summary}
            </span>
          )}
        </button>

        {/* Validation indicator */}
        {!expanded && (
          issues.length > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          ) : hasContent ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : null
        )}

        {/* Enabled toggle */}
        <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={script.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300 text-[#009688] focus:ring-[#009688]"
          />
          <span className="hidden sm:inline">Enabled</span>
        </label>

        {/* Move Up/Down */}
        <div className="flex flex-col -my-1">
          <button
            type="button"
            onClick={() => onMove(index, "up")}
            disabled={index === 0}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
            title="Move up"
          >
            <ArrowUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => onMove(index, "down")}
            disabled={index === total - 1}
            className="rounded p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30 transition-colors"
            title="Move down"
          >
            <ArrowDown className="h-3 w-3" />
          </button>
        </div>

        {/* Delete */}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
          title="Remove script"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-slate-200 px-4 py-4 space-y-4">
          {/* Label input */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600">Label</label>
            <input
              type="text"
              value={script.label}
              onChange={(e) => update({ label: e.target.value })}
              placeholder="Script name (e.g., Google Analytics)"
              className={inputClass}
            />
          </div>

          {/* Paste Snippet area */}
          {showPaste ? (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-600">Paste your script snippet</label>
              <textarea
                value={pasteValue}
                onChange={(e) => { setPasteValue(e.target.value); setParseError(""); }}
                placeholder={`Paste the full snippet here, e.g.:\n\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', 'G-XXXXXXX');\n</script>`}
                rows={7}
                className={`${inputClass} font-mono text-xs`}
              />
              {parseError && (
                <p className="flex items-center gap-1 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" /> {parseError}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleParse}
                  disabled={!pasteValue.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#009688] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
                >
                  <ClipboardPaste className="h-3 w-3" /> Parse Snippet
                </button>
                {hasContent && (
                  <button
                    type="button"
                    onClick={() => { setShowPaste(false); setPasteValue(""); setParseError(""); }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* Show parsed/manual fields */}
              <div className="space-y-3">
                {/* External URL */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">External URL</label>
                  <input
                    type="url"
                    value={script.src || ""}
                    onChange={(e) => update({ src: e.target.value })}
                    placeholder="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXX"
                    className={inputClass}
                  />
                </div>

                {/* Inline Code */}
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600">Inline Code</label>
                  <textarea
                    value={script.inline_code || ""}
                    onChange={(e) => update({ inline_code: e.target.value })}
                    placeholder={`window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-XXXXXXX');`}
                    rows={4}
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <p className="text-xs text-slate-500">JavaScript code without &lt;script&gt; tags</p>
                </div>

                {/* Re-paste button */}
                <button
                  type="button"
                  onClick={() => setShowPaste(true)}
                  className="flex items-center gap-1 text-xs text-[#009688] hover:text-[#00796b] transition-colors"
                >
                  <ClipboardPaste className="h-3 w-3" /> Paste new snippet
                </button>
              </div>

              {/* Validation status */}
              {issues.length > 0 ? (
                <div className="flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{issues.join(". ")}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Valid
                </div>
              )}
            </>
          )}

          {/* Advanced options toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Advanced options
          </button>

          {showAdvanced && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Placement</label>
                <select
                  value={script.placement}
                  onChange={(e) => update({ placement: e.target.value as ScriptPlacement })}
                  className={inputClass}
                >
                  <option value="head">Head (recommended)</option>
                  <option value="body_end">Body End</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">Loading Strategy</label>
                <select
                  value={script.loading_strategy}
                  onChange={(e) => update({ loading_strategy: e.target.value as ScriptLoadingStrategy })}
                  className={inputClass}
                >
                  <option value="async">Async (recommended, non-blocking)</option>
                  <option value="defer">Defer (after DOM parsed)</option>
                  <option value="blocking">Blocking (use with caution)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MAIN SECTION COMPONENT
// ============================================

export function ScriptsSection({
  scripts,
  onChange,
  saving,
  onSave,
}: {
  scripts: IB2CCustomScript[];
  onChange: (scripts: IB2CCustomScript[]) => void;
  saving: boolean;
  onSave: () => void;
}) {
  function handleScriptChange(index: number, updated: IB2CCustomScript) {
    const next = [...scripts];
    next[index] = updated;
    onChange(next);
  }

  function handleRemove(index: number) {
    onChange(scripts.filter((_, i) => i !== index));
  }

  function handleMove(index: number, direction: "up" | "down") {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= scripts.length) return;
    const next = [...scripts];
    [next[index], next[newIndex]] = [next[newIndex], next[index]];
    onChange(next);
  }

  function handleParsedMultiple(index: number, entries: IB2CCustomScript[]) {
    const next = [...scripts];
    next.splice(index, 1, ...entries);
    onChange(next);
  }

  function handleAdd() {
    onChange([...scripts, { ...DEFAULT_SCRIPT }]);
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Custom Scripts"
        description="Add third-party scripts like Google Analytics, Tag Manager, Iubenda, Facebook Pixel, etc. Paste the full snippet and it will be auto-detected. Scripts load asynchronously by default."
      >
        <div className="space-y-3">
          {scripts.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">
              No custom scripts configured. Click &quot;Add Script&quot; to get started.
            </p>
          )}

          {scripts.map((script, i) => (
            <ScriptEntry
              key={i}
              script={script}
              index={i}
              total={scripts.length}
              onChange={handleScriptChange}
              onRemove={handleRemove}
              onMove={handleMove}
              onParsedMultiple={handleParsedMultiple}
            />
          ))}

          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 hover:border-[#009688] hover:text-[#009688] transition-colors w-full justify-center"
          >
            <Plus className="h-4 w-4" />
            Add Script
          </button>
        </div>
      </SectionCard>

      {/* Save */}
      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save Scripts"}
        </button>
      </div>
    </div>
  );
}
