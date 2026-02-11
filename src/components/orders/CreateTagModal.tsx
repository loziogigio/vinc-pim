"use client";

import { useState, useEffect, useRef } from "react";
import { X, Tag, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buildFullTag,
  isValidPrefix,
  isValidCode,
} from "@/lib/constants/customer-tag";

const TAG_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#6366f1", // indigo
];

interface PrefixOption {
  value: string;
  label: string;
  description?: string;
  tagCount?: number;
}

interface CreateTagModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export function CreateTagModal({ open, onClose, onCreated }: CreateTagModalProps) {
  const [prefix, setPrefix] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefix combobox state
  const [prefixOptions, setPrefixOptions] = useState<PrefixOption[]>([]);
  const [showPrefixDropdown, setShowPrefixDropdown] = useState(false);
  const [prefixInput, setPrefixInput] = useState("");
  const prefixRef = useRef<HTMLDivElement>(null);

  // Load existing prefixes from API on mount
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("/api/b2b/customer-tags");
        if (res.ok) {
          const data = await res.json();
          const tags = data.tags || [];
          // Collect unique prefixes from existing tags in DB
          const prefixMap = new Map<string, number>();
          for (const t of tags) {
            const p = (t as { prefix: string }).prefix;
            prefixMap.set(p, (prefixMap.get(p) || 0) + 1);
          }
          const options: PrefixOption[] = Array.from(prefixMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([p, count]) => ({
              value: p,
              label: p,
              tagCount: count,
            }));
          setPrefixOptions(options);
        }
      } catch {
        setPrefixOptions([]);
      }
    })();
  }, [open]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (prefixRef.current && !prefixRef.current.contains(e.target as Node)) {
        setShowPrefixDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!open) return null;

  const slugifiedCode = code
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

  const fullTag = prefix && slugifiedCode ? buildFullTag(prefix, slugifiedCode) : "";
  const isCodeValid = slugifiedCode.length > 0 && isValidCode(slugifiedCode);

  // Filter prefix options by input
  const normalizedInput = prefixInput.toLowerCase().replace(/\s+/g, "-");
  const filteredOptions = prefixOptions.filter(
    (o) =>
      o.value.includes(normalizedInput) ||
      o.label.toLowerCase().includes(prefixInput.toLowerCase())
  );
  const exactMatch = prefixOptions.some((o) => o.value === normalizedInput);
  const showCreateNew = normalizedInput.length > 0 && isValidPrefix(normalizedInput) && !exactMatch;

  function selectPrefix(value: string) {
    setPrefix(value);
    setPrefixInput(value);
    setShowPrefixDropdown(false);
  }

  function handlePrefixInputChange(value: string) {
    const normalized = value.toLowerCase().replace(/\s+/g, "-");
    setPrefixInput(value);
    setPrefix(normalized);
    setShowPrefixDropdown(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidPrefix(prefix) || !isCodeValid || !description.trim()) return;

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/b2b/customer-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix,
          code: slugifiedCode,
          description: description.trim(),
          color,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create tag");
        return;
      }

      // Reset form and notify parent
      setPrefix("");
      setPrefixInput("");
      setCode("");
      setDescription("");
      setColor(TAG_COLORS[0]);
      setError(null);
      onCreated();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 p-6">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Tag className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Create Customer Tag</h3>
            <p className="text-sm text-slate-500">Define a new tag for customer segmentation</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Prefix */}
          <div ref={prefixRef}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Prefix (Category) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Input
                value={prefixInput}
                onChange={(e) => handlePrefixInputChange(e.target.value)}
                onFocus={() => setShowPrefixDropdown(true)}
                placeholder="Select or type a new prefix..."
                autoComplete="off"
              />

              {/* Dropdown */}
              {showPrefixDropdown && (filteredOptions.length > 0 || showCreateNew) && (
                <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => selectPrefix(opt.value)}
                      className={`w-full text-left px-3 py-2 hover:bg-emerald-50 transition text-sm ${
                        prefix === opt.value ? "bg-emerald-50 text-emerald-700" : "text-slate-700"
                      }`}
                    >
                      <span className="font-medium font-mono">{opt.value}</span>
                      <span className="text-xs text-slate-400 ml-2">
                        {opt.tagCount} tag{opt.tagCount !== 1 ? "s" : ""}
                      </span>
                    </button>
                  ))}
                  {showCreateNew && (
                    <button
                      type="button"
                      onClick={() => selectPrefix(normalizedInput)}
                      className="w-full text-left px-3 py-2 hover:bg-emerald-50 transition text-sm border-t border-slate-100 text-emerald-600"
                    >
                      <Plus className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
                      Create new prefix: <span className="font-mono font-medium">{normalizedInput}</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {prefix && !isValidPrefix(prefix) && (
              <p className="text-xs text-red-500 mt-1">
                Prefix must be lowercase kebab-case (e.g., my-new-category)
              </p>
            )}
          </div>

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Code <span className="text-red-500">*</span>
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., sconto-45, idraulico, fascia-alta"
            />
            {code && !isCodeValid && (
              <p className="text-xs text-red-500 mt-1">
                Code must be lowercase kebab-case (e.g., sconto-45)
              </p>
            )}
          </div>

          {/* Full tag preview */}
          {prefix && isValidPrefix(prefix) && slugifiedCode && (
            <div className="px-3 py-2 bg-slate-50 rounded-md border border-slate-200 space-y-1">
              <p className="text-xs text-slate-500">Saved as (use in API)</p>
              <div className="flex items-center gap-3 text-sm font-mono">
                <span>
                  <span className="text-slate-400">prefix: </span>
                  <span className="font-medium text-slate-800">{prefix}</span>
                </span>
                <span className="text-slate-300">|</span>
                <span>
                  <span className="text-slate-400">full_tag: </span>
                  <span className="font-medium text-slate-800">{fullTag}</span>
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Sconto base 45% su listino"
              rows={2}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Color</label>
            <div className="flex gap-2 flex-wrap">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    color === c ? "border-slate-800 scale-110" : "border-transparent hover:scale-105"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!isValidPrefix(prefix) || !isCodeValid || !description.trim() || saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? "Creating..." : "Create Tag"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
