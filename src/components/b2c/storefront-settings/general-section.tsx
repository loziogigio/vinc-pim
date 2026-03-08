"use client";

import { Plus, X, Save, Loader2 } from "lucide-react";
import { ChannelSelect } from "@/components/shared/ChannelSelect";
import { SectionCard } from "./section-card";
import { Field, inputClass } from "./field-helpers";
import type { DomainEntry } from "./types";

// ============================================
// Domain List Input
// ============================================

function DomainListInput({
  domains,
  onChange,
}: {
  domains: DomainEntry[];
  onChange: (domains: DomainEntry[]) => void;
}) {
  function add() {
    onChange([...domains, { protocol: "https", host: "", is_primary: domains.length === 0 }]);
  }

  function update(index: number, field: "protocol" | "host", value: string) {
    onChange(domains.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  function setPrimary(index: number) {
    onChange(domains.map((d, i) => ({ ...d, is_primary: i === index })));
  }

  function remove(index: number) {
    const next = domains.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((d) => d.is_primary)) {
      next[0].is_primary = true;
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {domains.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPrimary(i)}
            title={d.is_primary ? "Primary domain" : "Set as primary"}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium transition-colors ${
              d.is_primary
                ? "border-[#009688] bg-[#009688] text-white"
                : "border-slate-200 bg-white text-slate-400 hover:border-[#009688] hover:text-[#009688]"
            }`}
          >
            {d.is_primary ? "P" : i + 1}
          </button>
          <select
            value={d.protocol}
            onChange={(e) => update(i, "protocol", e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-700 focus:border-[#009688] focus:outline-none bg-gray-50"
          >
            <option value="https">https://</option>
            <option value="http">http://</option>
          </select>
          <input
            type="text"
            value={d.host}
            onChange={(e) => update(i, "host", e.target.value)}
            placeholder="www.example.com"
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-md p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#009688] hover:text-[#00796b]"
        >
          <Plus className="h-3.5 w-3.5" />
          Add domain
        </button>
        {domains.length > 1 && (
          <span className="text-xs text-slate-400">
            Click the circle to set the primary domain (used in email links)
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// General Section
// ============================================

export function GeneralSection({
  name,
  onNameChange,
  channel,
  onChannelChange,
  domains,
  onDomainsChange,
  status,
  onStatusChange,
  defaultLanguage,
  onDefaultLanguageChange,
  saving,
  onSave,
}: {
  name: string;
  onNameChange: (v: string) => void;
  channel: string;
  onChannelChange: (v: string) => void;
  domains: DomainEntry[];
  onDomainsChange: (d: DomainEntry[]) => void;
  status: "active" | "inactive";
  onStatusChange: (v: "active" | "inactive") => void;
  defaultLanguage: string;
  onDefaultLanguageChange: (v: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <SectionCard title="General Settings" description="Name, domains, channel, and status of this storefront.">
      <div className="space-y-4">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className={inputClass}
          />
        </Field>

        <ChannelSelect
          value={channel}
          onChange={onChannelChange}
          label="Channel"
          required
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Domains</label>
          <DomainListInput domains={domains} onChange={onDomainsChange} />
          <p className="mt-1 text-xs text-slate-500">
            Used to identify which storefront a B2C frontend belongs to via the Origin header.
          </p>
        </div>

        <Field label="Status">
          <select
            value={status}
            onChange={(e) => onStatusChange(e.target.value as "active" | "inactive")}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>

        <Field label="Default Language">
          <input
            type="text"
            value={defaultLanguage}
            onChange={(e) => onDefaultLanguageChange(e.target.value)}
            placeholder="it"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </SectionCard>
  );
}

export { type DomainEntry };

export function parseDomainEntry(
  raw: string | { domain: string; is_primary?: boolean },
  fallbackPrimary: boolean
): DomainEntry {
  const domain = typeof raw === "string" ? raw : raw.domain;
  const is_primary =
    typeof raw === "string" ? fallbackPrimary : (raw.is_primary ?? fallbackPrimary);
  if (domain.startsWith("https://")) return { protocol: "https", host: domain.slice(8), is_primary };
  if (domain.startsWith("http://")) return { protocol: "http", host: domain.slice(7), is_primary };
  return { protocol: "https", host: domain, is_primary };
}

export function formatDomain(d: DomainEntry): string {
  return `${d.protocol}://${d.host.trim()}`;
}
