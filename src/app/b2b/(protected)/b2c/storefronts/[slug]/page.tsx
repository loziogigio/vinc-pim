"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Pencil,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";

// ============================================================
// Domain helpers
// ============================================================

interface DomainEntry {
  protocol: "https" | "http";
  host: string;
}

function parseDomain(raw: string): DomainEntry {
  if (raw.startsWith("https://")) return { protocol: "https", host: raw.slice(8) };
  if (raw.startsWith("http://")) return { protocol: "http", host: raw.slice(7) };
  return { protocol: "https", host: raw };
}

function formatDomain(d: DomainEntry): string {
  return `${d.protocol}://${d.host.trim()}`;
}

function DomainListInput({
  domains,
  onChange,
}: {
  domains: DomainEntry[];
  onChange: (domains: DomainEntry[]) => void;
}) {
  function add() {
    onChange([...domains, { protocol: "https", host: "" }]);
  }

  function update(index: number, field: keyof DomainEntry, value: string) {
    onChange(domains.map((d, i) => (i === index ? { ...d, [field]: value } : d)));
  }

  function remove(index: number) {
    onChange(domains.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      {domains.map((d, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <select
            value={d.protocol}
            onChange={(e) => update(i, "protocol", e.target.value)}
            className="rounded-lg border border-[#ebe9f1] px-2 py-2 text-sm text-[#5e5873] focus:border-[#009688] focus:outline-none bg-gray-50"
          >
            <option value="https">https://</option>
            <option value="http">http://</option>
          </select>
          <input
            type="text"
            value={d.host}
            onChange={(e) => update(i, "host", e.target.value)}
            placeholder="www.example.com"
            className="flex-1 rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded-md p-1.5 text-[#b9b9c3] hover:text-red-500 hover:bg-red-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#009688] hover:text-[#00796b]"
      >
        <Plus className="h-3.5 w-3.5" />
        Add domain
      </button>
    </div>
  );
}
import type {
  IB2CStorefrontBranding,
  IB2CStorefrontHeader,
  IB2CStorefrontFooter,
  IHeaderNavLink,
  IFooterColumn,
  IFooterSocial,
} from "@/lib/db/models/b2c-storefront";

// ============================================
// TYPES
// ============================================

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  domains: string[];
  status: "active" | "inactive";
  branding: IB2CStorefrontBranding;
  header: IB2CStorefrontHeader;
  footer: IB2CStorefrontFooter;
  settings: {
    default_language?: string;
    theme?: string;
  };
  created_at: string;
  updated_at: string;
}

// ============================================
// COLLAPSIBLE SECTION COMPONENT
// ============================================

function Section({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-[#ebe9f1] bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <h2 className="font-semibold text-[#5e5873]">{title}</h2>
        {open ? (
          <ChevronDown className="h-4 w-4 text-[#b9b9c3]" />
        ) : (
          <ChevronRight className="h-4 w-4 text-[#b9b9c3]" />
        )}
      </button>
      {open && <div className="border-t border-[#ebe9f1] px-6 py-4">{children}</div>}
    </div>
  );
}

// ============================================
// FORM FIELD HELPERS
// ============================================

const inputClass =
  "w-full rounded-lg border border-[#ebe9f1] px-3 py-2 text-sm focus:border-[#009688] focus:outline-none";
const labelClass = "block text-sm font-medium text-[#5e5873] mb-1";
const helperClass = "mt-1 text-xs text-[#b9b9c3]";

function Field({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {helper && <p className={helperClass}>{helper}</p>}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 cursor-pointer rounded border border-[#ebe9f1] p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#009688"
          className={inputClass}
        />
      </div>
      {helper && <p className={helperClass}>{helper}</p>}
    </div>
  );
}

// ============================================
// PAGE COMPONENT
// ============================================

export default function StorefrontDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname() || "";
  const tenantPrefix =
    pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // General
  const [name, setName] = useState("");
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [defaultLanguage, setDefaultLanguage] = useState("");

  // Branding
  const [branding, setBranding] = useState<IB2CStorefrontBranding>({});

  // Header
  const [header, setHeader] = useState<IB2CStorefrontHeader>({
    show_search: true,
    show_cart: true,
    show_account: true,
  });

  // Footer
  const [footer, setFooter] = useState<IB2CStorefrontFooter>({});

  useEffect(() => {
    fetch(`/api/b2b/b2c/storefronts/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          const sf = data.data as Storefront;
          setStorefront(sf);
          setName(sf.name);
          setDomains(sf.domains.map(parseDomain));
          setStatus(sf.status);
          setDefaultLanguage(sf.settings?.default_language || "");
          setBranding(sf.branding || {});
          setHeader(sf.header || { show_search: true, show_cart: true, show_account: true });
          setFooter(sf.footer || {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const formattedDomains = domains
        .map(formatDomain)
        .filter((d) => d.replace(/^https?:\/\//, "").trim() !== "");

      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          domains: formattedDomains,
          status,
          branding,
          header,
          footer,
          settings: { default_language: defaultLanguage || undefined },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }

      setStorefront(data.data);
      setSuccess("Storefront updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Branding helpers
  function updateBranding<K extends keyof IB2CStorefrontBranding>(
    key: K,
    value: IB2CStorefrontBranding[K]
  ) {
    setBranding((prev) => ({ ...prev, [key]: value }));
  }

  // Header helpers
  function updateHeader<K extends keyof IB2CStorefrontHeader>(
    key: K,
    value: IB2CStorefrontHeader[K]
  ) {
    setHeader((prev) => ({ ...prev, [key]: value }));
  }

  function addNavLink() {
    const links = [...(header.nav_links || []), { label: "", href: "" }];
    updateHeader("nav_links", links);
  }

  function updateNavLink(index: number, field: keyof IHeaderNavLink, value: string | boolean) {
    const links = [...(header.nav_links || [])];
    links[index] = { ...links[index], [field]: value };
    updateHeader("nav_links", links);
  }

  function removeNavLink(index: number) {
    const links = (header.nav_links || []).filter((_, i) => i !== index);
    updateHeader("nav_links", links);
  }

  // Footer helpers
  function updateFooter<K extends keyof IB2CStorefrontFooter>(
    key: K,
    value: IB2CStorefrontFooter[K]
  ) {
    setFooter((prev) => ({ ...prev, [key]: value }));
  }

  function addFooterColumn() {
    const cols = [...(footer.columns || []), { title: "", links: [] }];
    updateFooter("columns", cols);
  }

  function updateFooterColumn(index: number, title: string) {
    const cols = [...(footer.columns || [])];
    cols[index] = { ...cols[index], title };
    updateFooter("columns", cols);
  }

  function removeFooterColumn(index: number) {
    const cols = (footer.columns || []).filter((_, i) => i !== index);
    updateFooter("columns", cols);
  }

  function addFooterLink(colIndex: number) {
    const cols = [...(footer.columns || [])];
    cols[colIndex] = {
      ...cols[colIndex],
      links: [...cols[colIndex].links, { label: "", href: "" }],
    };
    updateFooter("columns", cols);
  }

  function updateFooterLink(
    colIndex: number,
    linkIndex: number,
    field: string,
    value: string | boolean
  ) {
    const cols = [...(footer.columns || [])];
    const links = [...cols[colIndex].links];
    links[linkIndex] = { ...links[linkIndex], [field]: value };
    cols[colIndex] = { ...cols[colIndex], links };
    updateFooter("columns", cols);
  }

  function removeFooterLink(colIndex: number, linkIndex: number) {
    const cols = [...(footer.columns || [])];
    cols[colIndex] = {
      ...cols[colIndex],
      links: cols[colIndex].links.filter((_, i) => i !== linkIndex),
    };
    updateFooter("columns", cols);
  }

  function addSocialLink() {
    const links = [...(footer.social_links || []), { platform: "", url: "" }];
    updateFooter("social_links", links);
  }

  function updateSocialLink(index: number, field: keyof IFooterSocial, value: string) {
    const links = [...(footer.social_links || [])];
    links[index] = { ...links[index], [field]: value };
    updateFooter("social_links", links);
  }

  function removeSocialLink(index: number) {
    const links = (footer.social_links || []).filter((_, i) => i !== index);
    updateFooter("social_links", links);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
      </div>
    );
  }

  if (!storefront) {
    return (
      <div className="p-6">
        <p className="text-[#b9b9c3]">Storefront not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href={`${tenantPrefix}/b2b/b2c/storefronts`}
          className="rounded-md p-1 text-[#b9b9c3] hover:text-[#5e5873] hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-[#5e5873]">
            {storefront.name}
          </h1>
          <p className="text-sm text-[#b9b9c3]">
            Slug: {storefront.slug}
          </p>
        </div>
        <Link
          href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${slug}`}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
        >
          <Pencil className="h-4 w-4" />
          Open Builder
        </Link>
      </div>

      {/* Feedback */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
          {success}
        </div>
      )}

      <div className="max-w-3xl space-y-4">
        {/* General Settings */}
        <Section title="General Settings" defaultOpen>
          <div className="space-y-4">
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div>
              <label className={labelClass}>Domains</label>
              <DomainListInput domains={domains} onChange={setDomains} />
              <p className={helperClass}>
                Used to identify which storefront a B2C frontend belongs to via the Origin header.
              </p>
            </div>

            <Field label="Status">
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "inactive")
                }
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
                onChange={(e) => setDefaultLanguage(e.target.value)}
                placeholder="it"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Branding */}
        <Section title="Branding">
          <div className="space-y-4">
            <Field
              label="Company Title"
              helper="Appears in navigation, browser tab, and email templates."
            >
              <input
                type="text"
                value={branding.title || ""}
                onChange={(e) => updateBranding("title", e.target.value)}
                placeholder="My Store"
                className={inputClass}
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Logo URL"
                helper="SVG or PNG with transparent background."
              >
                <input
                  type="text"
                  value={branding.logo_url || ""}
                  onChange={(e) => updateBranding("logo_url", e.target.value)}
                  placeholder="https://example.com/logo.svg"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Favicon URL"
                helper="Square image (32x32 or 64x64) for browser tabs."
              >
                <input
                  type="text"
                  value={branding.favicon_url || ""}
                  onChange={(e) => updateBranding("favicon_url", e.target.value)}
                  placeholder="https://example.com/favicon.ico"
                  className={inputClass}
                />
              </Field>
            </div>

            {/* Logo/Favicon previews */}
            <div className="flex items-center gap-6">
              {branding.logo_url && (
                <div className="space-y-1">
                  <p className="text-xs text-[#b9b9c3]">Logo preview</p>
                  <div className="flex h-12 w-24 items-center justify-center rounded border border-[#ebe9f1] bg-gray-50 p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.logo_url}
                      alt="Logo"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
              {branding.favicon_url && (
                <div className="space-y-1">
                  <p className="text-xs text-[#b9b9c3]">Favicon preview</p>
                  <div className="flex h-8 w-8 items-center justify-center rounded border border-[#ebe9f1] bg-gray-50 p-0.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={branding.favicon_url}
                      alt="Favicon"
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <ColorField
                label="Primary Color"
                value={branding.primary_color || ""}
                onChange={(v) => updateBranding("primary_color", v)}
                helper="Buttons, highlights"
              />
              <ColorField
                label="Secondary Color"
                value={branding.secondary_color || ""}
                onChange={(v) => updateBranding("secondary_color", v)}
                helper="Accents, hover states"
              />
              <ColorField
                label="Accent Color"
                value={branding.accent_color || ""}
                onChange={(v) => updateBranding("accent_color", v)}
                helper="Badges, alerts"
              />
            </div>

            <Field label="Font Family" helper="e.g., Inter, Roboto, Open Sans">
              <input
                type="text"
                value={branding.font_family || ""}
                onChange={(e) => updateBranding("font_family", e.target.value)}
                placeholder="Inter"
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        {/* Header */}
        <Section title="Header">
          <div className="space-y-6">
            {/* Announcement Bar */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#5e5873]">Announcement Bar</p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={header.announcement_enabled || false}
                    onChange={(e) => updateHeader("announcement_enabled", e.target.checked)}
                    className="rounded border-[#ebe9f1]"
                  />
                  Enabled
                </label>
              </div>

              {header.announcement_enabled && (
                <div className="space-y-3 rounded-lg border border-[#ebe9f1] bg-gray-50 p-4">
                  <Field label="Text">
                    <input
                      type="text"
                      value={header.announcement_text || ""}
                      onChange={(e) => updateHeader("announcement_text", e.target.value)}
                      placeholder="Free shipping over €50"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Link URL">
                    <input
                      type="text"
                      value={header.announcement_link || ""}
                      onChange={(e) => updateHeader("announcement_link", e.target.value)}
                      placeholder="/promotions"
                      className={inputClass}
                    />
                  </Field>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ColorField
                      label="Background"
                      value={header.announcement_bg_color || ""}
                      onChange={(v) => updateHeader("announcement_bg_color", v)}
                    />
                    <ColorField
                      label="Text Color"
                      value={header.announcement_text_color || ""}
                      onChange={(v) => updateHeader("announcement_text_color", v)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#5e5873]">Navigation Links</p>
                <button
                  type="button"
                  onClick={addNavLink}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#009688] hover:text-[#00796b]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add link
                </button>
              </div>

              {(header.nav_links || []).map((link, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={link.label}
                    onChange={(e) => updateNavLink(i, "label", e.target.value)}
                    placeholder="Label"
                    className={`${inputClass} flex-1`}
                  />
                  <input
                    type="text"
                    value={link.href}
                    onChange={(e) => updateNavLink(i, "href", e.target.value)}
                    placeholder="/shop"
                    className={`${inputClass} flex-1`}
                  />
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={link.open_in_new_tab || false}
                      onChange={(e) => updateNavLink(i, "open_in_new_tab", e.target.checked)}
                      className="rounded border-[#ebe9f1]"
                    />
                    New tab
                  </label>
                  <button
                    type="button"
                    onClick={() => removeNavLink(i)}
                    className="p-1 text-[#b9b9c3] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Header toggles */}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-[#5e5873]">
                <input
                  type="checkbox"
                  checked={header.show_search ?? true}
                  onChange={(e) => updateHeader("show_search", e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                Show Search
              </label>
              <label className="flex items-center gap-2 text-sm text-[#5e5873]">
                <input
                  type="checkbox"
                  checked={header.show_cart ?? true}
                  onChange={(e) => updateHeader("show_cart", e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                Show Cart
              </label>
              <label className="flex items-center gap-2 text-sm text-[#5e5873]">
                <input
                  type="checkbox"
                  checked={header.show_account ?? true}
                  onChange={(e) => updateHeader("show_account", e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                Show Account
              </label>
            </div>
          </div>
        </Section>

        {/* Footer */}
        <Section title="Footer">
          <div className="space-y-6">
            {/* Footer Colors */}
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField
                label="Background Color"
                value={footer.bg_color || ""}
                onChange={(v) => updateFooter("bg_color", v)}
              />
              <ColorField
                label="Text Color"
                value={footer.text_color || ""}
                onChange={(v) => updateFooter("text_color", v)}
              />
            </div>

            {/* Copyright */}
            <Field
              label="Copyright Text"
              helper="e.g., © 2026 Company Srl - P.IVA 12345678901"
            >
              <input
                type="text"
                value={footer.copyright_text || ""}
                onChange={(e) => updateFooter("copyright_text", e.target.value)}
                placeholder="© 2026 My Company"
                className={inputClass}
              />
            </Field>

            {/* Newsletter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-[#5e5873]">
                <input
                  type="checkbox"
                  checked={footer.show_newsletter || false}
                  onChange={(e) => updateFooter("show_newsletter", e.target.checked)}
                  className="rounded border-[#ebe9f1]"
                />
                Show Newsletter Signup
              </label>
              {footer.show_newsletter && (
                <div className="grid gap-3 md:grid-cols-2 rounded-lg border border-[#ebe9f1] bg-gray-50 p-4">
                  <Field label="Heading">
                    <input
                      type="text"
                      value={footer.newsletter_heading || ""}
                      onChange={(e) => updateFooter("newsletter_heading", e.target.value)}
                      placeholder="Stay updated"
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Placeholder">
                    <input
                      type="text"
                      value={footer.newsletter_placeholder || ""}
                      onChange={(e) => updateFooter("newsletter_placeholder", e.target.value)}
                      placeholder="Enter your email"
                      className={inputClass}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* Footer Columns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#5e5873]">Link Columns</p>
                <button
                  type="button"
                  onClick={addFooterColumn}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#009688] hover:text-[#00796b]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add column
                </button>
              </div>

              {(footer.columns || []).map((col, colIdx) => (
                <div
                  key={colIdx}
                  className="rounded-lg border border-[#ebe9f1] bg-gray-50 p-4 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={col.title}
                      onChange={(e) => updateFooterColumn(colIdx, e.target.value)}
                      placeholder="Column title"
                      className={`${inputClass} flex-1 font-medium`}
                    />
                    <button
                      type="button"
                      onClick={() => removeFooterColumn(colIdx)}
                      className="p-1 text-[#b9b9c3] hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {col.links.map((link, linkIdx) => (
                    <div key={linkIdx} className="flex items-center gap-2 pl-4">
                      <input
                        type="text"
                        value={link.label}
                        onChange={(e) =>
                          updateFooterLink(colIdx, linkIdx, "label", e.target.value)
                        }
                        placeholder="Label"
                        className={`${inputClass} flex-1`}
                      />
                      <input
                        type="text"
                        value={link.href}
                        onChange={(e) =>
                          updateFooterLink(colIdx, linkIdx, "href", e.target.value)
                        }
                        placeholder="/page"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={() => removeFooterLink(colIdx, linkIdx)}
                        className="p-1 text-[#b9b9c3] hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => addFooterLink(colIdx)}
                    className="ml-4 inline-flex items-center gap-1 text-xs text-[#009688] hover:text-[#00796b]"
                  >
                    <Plus className="h-3 w-3" /> Add link
                  </button>
                </div>
              ))}
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[#5e5873]">Social Links</p>
                <button
                  type="button"
                  onClick={addSocialLink}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#009688] hover:text-[#00796b]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add social
                </button>
              </div>

              {(footer.social_links || []).map((social, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={social.platform}
                    onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                    className={`${inputClass} w-36`}
                  >
                    <option value="">Platform</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="twitter">X / Twitter</option>
                    <option value="linkedin">LinkedIn</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="pinterest">Pinterest</option>
                  </select>
                  <input
                    type="text"
                    value={social.url}
                    onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                    placeholder="https://..."
                    className={`${inputClass} flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => removeSocialLink(i)}
                    className="p-1 text-[#b9b9c3] hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <div className="pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-6 py-2.5 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
