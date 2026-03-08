"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Pencil, FileText, Inbox } from "lucide-react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { GeneralSection, parseDomainEntry, formatDomain } from "@/components/b2c/storefront-settings/general-section";
import { BrandingSection } from "@/components/b2c/storefront-settings/branding-section";
import { HeaderSection, DEFAULT_B2C_HEADER_CONFIG } from "@/components/b2c/storefront-settings/header-section";
import { FooterSection } from "@/components/b2c/storefront-settings/footer-section";
import { SeoSection } from "@/components/b2c/storefront-settings/seo-section";
import type { StorefrontActiveSection, DomainEntry, IB2CStorefrontBranding, IB2CStorefrontFooter, IB2CStorefrontMetaTags, HeaderConfig } from "@/components/b2c/storefront-settings/types";

interface Storefront {
  _id: string;
  name: string;
  slug: string;
  channel?: string;
  domains: (string | { domain: string; is_primary?: boolean })[];
  status: "active" | "inactive";
  branding: IB2CStorefrontBranding;
  header_config?: HeaderConfig;
  header_config_draft?: HeaderConfig;
  footer: IB2CStorefrontFooter;
  footer_draft?: IB2CStorefrontFooter;
  meta_tags?: IB2CStorefrontMetaTags;
  settings: { default_language?: string; theme?: string };
  created_at: string;
  updated_at: string;
}

const EMPTY_HEADER_CONFIG: HeaderConfig = { rows: [] };

export default function StorefrontDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const activeSection = (searchParams.get("section") || "general") as StorefrontActiveSection;

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // General
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [defaultLanguage, setDefaultLanguage] = useState("");

  // Branding
  const [branding, setBranding] = useState<IB2CStorefrontBranding>({});

  // Header (row/block/widget builder)
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(EMPTY_HEADER_CONFIG);
  const [headerConfigDraft, setHeaderConfigDraft] = useState<HeaderConfig>(EMPTY_HEADER_CONFIG);

  // Footer
  const [footer, setFooter] = useState<IB2CStorefrontFooter>({});
  const [footerDraft, setFooterDraft] = useState<IB2CStorefrontFooter>({});

  // SEO
  const [metaTags, setMetaTags] = useState<IB2CStorefrontMetaTags>({});

  // Load storefront
  useEffect(() => {
    fetch(`/api/b2b/b2c/storefronts/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          const sf = data.data as Storefront;
          setStorefront(sf);
          setName(sf.name);
          setChannel(sf.channel || "");
          setDomains(sf.domains.map((d, i) => parseDomainEntry(d, i === 0)));
          setStatus(sf.status);
          setDefaultLanguage(sf.settings?.default_language || "");
          setBranding(sf.branding || {});
          setHeaderConfig(sf.header_config || EMPTY_HEADER_CONFIG);
          setHeaderConfigDraft(sf.header_config_draft || sf.header_config || DEFAULT_B2C_HEADER_CONFIG);
          setFooter(sf.footer || {});
          setFooterDraft(sf.footer_draft ?? sf.footer ?? {});
          setMetaTags(sf.meta_tags || {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  // Save all current state
  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const formattedDomains = domains
        .filter((d) => d.host.trim() !== "")
        .map((d) => ({ domain: formatDomain(d), is_primary: d.is_primary }));

      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          channel: channel || undefined,
          domains: formattedDomains,
          status,
          branding,
          header_config: headerConfig,
          header_config_draft: headerConfigDraft,
          footer,
          footer_draft: footerDraft,
          meta_tags: metaTags,
          settings: { default_language: defaultLanguage || undefined },
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to update"); return; }
      setStorefront(data.data);
      setSuccess("Storefront updated successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Publish header: copy draft to published and save
  async function handlePublishHeader() {
    setHeaderConfig(headerConfigDraft);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ header_config: headerConfigDraft, header_config_draft: headerConfigDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to publish header"); return; }
      setStorefront(data.data);
      setSuccess("Header published");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // Publish footer: copy draft to published and save
  async function handlePublishFooter() {
    setFooter(footerDraft);
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/b2b/b2c/storefronts/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ footer: footerDraft, footer_draft: footerDraft }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to publish footer"); return; }
      setStorefront(data.data);
      setSuccess("Footer published");
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  // SEO meta tags change handler
  function handleMetaTagChange(key: keyof IB2CStorefrontMetaTags, value: string) {
    setMetaTags((prev) => ({ ...prev, [key]: value }));
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
        <p className="text-slate-400">Storefront not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: "/b2b/b2c" },
          { label: storefront.name },
        ]}
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{storefront.name}</h1>
          <p className="text-sm text-slate-400">Slug: {storefront.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${tenantPrefix}/b2b/b2c/storefronts/${slug}/pages`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <FileText className="h-4 w-4" /> Pages
          </Link>
          <Link
            href={`${tenantPrefix}/b2b/b2c/storefronts/${slug}/forms`}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Inbox className="h-4 w-4" /> Forms
          </Link>
          <Link
            href={`${tenantPrefix}/b2b/b2c-home-builder?storefront=${slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-4 py-2 text-sm font-medium text-white hover:bg-[#00796b] transition-colors"
          >
            <Pencil className="h-4 w-4" /> Home Builder
          </Link>
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{success}</div>
      )}

      {/* Content */}
      <div className="space-y-6">
        {activeSection === "general" && (
          <GeneralSection
            name={name}
            onNameChange={setName}
            channel={channel}
            onChannelChange={setChannel}
            domains={domains}
            onDomainsChange={setDomains}
            status={status}
            onStatusChange={setStatus}
            defaultLanguage={defaultLanguage}
            onDefaultLanguageChange={setDefaultLanguage}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "branding" && (
          <BrandingSection
            branding={branding}
            onBrandingChange={setBranding}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "header" && (
          <HeaderSection
            headerConfig={headerConfig}
            headerConfigDraft={headerConfigDraft}
            onDraftChange={setHeaderConfigDraft}
            onPublish={handlePublishHeader}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "footer" && (
          <FooterSection
            footer={footer}
            footerDraft={footerDraft}
            onDraftChange={setFooterDraft}
            onPublish={handlePublishFooter}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "seo" && (
          <SeoSection
            metaTags={metaTags}
            onChange={handleMetaTagChange}
            saving={saving}
            onSave={handleSave}
          />
        )}
      </div>
    </div>
  );
}
