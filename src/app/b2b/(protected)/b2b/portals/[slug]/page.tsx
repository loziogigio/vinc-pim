"use client";

/**
 * B2B Portal detail page — section tabs (?section=general|branding|header|footer|seo|scripts|sitemap).
 *
 * Mirrors src/app/b2b/(protected)/b2c/storefronts/[slug]/page.tsx. The 7 presentational
 * section components in @/components/b2c/storefront-settings/* are reused unchanged — only
 * this host page differs: it talks to the Phase-1 /api/b2b/b2b/portals/[slug]* routes,
 * shows a "synthesized" banner for unmigrated tenants, and surfaces the 409 NOT_MIGRATED
 * write-gate as a dedicated hint instead of a generic error.
 */

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Pencil, FileText, Inbox } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { LanguageTabs } from "@/components/common/LanguageTabs";
import { useLanguageStore } from "@/lib/stores/languageStore";
import { getDefaultLanguage } from "@/config/languages";
import { headerPublishPatch, footerPublishPatch } from "@/lib/services/portal-section-lang";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { GeneralSection, parseDomainEntry, formatDomain } from "@/components/b2c/storefront-settings/general-section";
import { BrandingSection } from "@/components/b2c/storefront-settings/branding-section";
import { HeaderSection, DEFAULT_B2C_HEADER_CONFIG } from "@/components/b2c/storefront-settings/header-section";
import { FooterSection } from "@/components/b2c/storefront-settings/footer-section";
import { SeoSection } from "@/components/b2c/storefront-settings/seo-section";
import { ScriptsSection } from "@/components/b2c/storefront-settings/scripts-section";
import { CssSection } from "@/components/b2c/storefront-settings/css-section";
import { SitemapSection } from "@/components/b2c/storefront-settings/sitemap-section";
import { FacetsSection } from "@/components/b2c/storefront-settings/facets-section";
import type { StorefrontActiveSection, DomainEntry, IB2CStorefrontBranding, IB2CStorefrontFooter, IB2CStorefrontMetaTags, IB2CCustomScript, HeaderConfig } from "@/components/b2c/storefront-settings/types";
import type { B2BPortalStatus, IB2BPortalFacetConfig } from "@/lib/types/b2b-portal";

interface Portal {
  _id: string;
  name: string;
  slug: string;
  channel?: string;
  domains: (string | { domain: string; is_primary?: boolean })[];
  status: B2BPortalStatus;
  branding: IB2CStorefrontBranding;
  header_config?: HeaderConfig;
  header_config_draft?: HeaderConfig;
  header_config_by_lang?: Record<string, HeaderConfig>;
  header_config_draft_by_lang?: Record<string, HeaderConfig>;
  footer: IB2CStorefrontFooter;
  footer_draft?: IB2CStorefrontFooter;
  footer_by_lang?: Record<string, IB2CStorefrontFooter>;
  footer_draft_by_lang?: Record<string, IB2CStorefrontFooter>;
  meta_tags?: IB2CStorefrontMetaTags;
  custom_scripts?: IB2CCustomScript[];
  custom_css?: string;
  facet_config?: IB2BPortalFacetConfig;
  settings: { default_language?: string; theme?: string };
  created_at: string;
  updated_at: string;
  /** Present when the tenant has not been migrated — the portal is synthesized from b2bhomesettings. */
  synthesized?: boolean;
}

const EMPTY_HEADER_CONFIG: HeaderConfig = { rows: [] };

export default function PortalDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useTranslation();
  const pathname = usePathname() || "";
  const searchParams = useSearchParams();
  const tenantPrefix = pathname.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const activeSection = (searchParams.get("section") || "general") as StorefrontActiveSection;

  const [portal, setPortal] = useState<Portal | null>(null);
  const [synthesized, setSynthesized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notMigrated, setNotMigrated] = useState(false);
  const [success, setSuccess] = useState("");

  // General
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [domains, setDomains] = useState<DomainEntry[]>([]);
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [defaultLanguage, setDefaultLanguage] = useState("");

  // Branding
  const [branding, setBranding] = useState<IB2CStorefrontBranding>({});

  // Language state (per-language header/footer tabs)
  const allLanguages = useLanguageStore((s) => s.languages);
  const fetchLanguages = useLanguageStore((s) => s.fetchLanguages);
  const langsLoading = useLanguageStore((s) => s.isLoading);
  const enabledLanguages = useMemo(() => allLanguages.filter((l) => l.isEnabled), [allLanguages]);
  const DEFAULT_LANG = getDefaultLanguage().code;
  const [headerLang, setHeaderLang] = useState(DEFAULT_LANG);
  const [footerLang, setFooterLang] = useState(DEFAULT_LANG);
  const [headerDraftByLang, setHeaderDraftByLang] = useState<Record<string, HeaderConfig>>({});
  const [headerPubByLang, setHeaderPubByLang] = useState<Record<string, HeaderConfig>>({});
  const [footerDraftByLang, setFooterDraftByLang] = useState<Record<string, IB2CStorefrontFooter>>({});
  const [footerPubByLang, setFooterPubByLang] = useState<Record<string, IB2CStorefrontFooter>>({});

  // Header (row/block/widget builder)
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(EMPTY_HEADER_CONFIG);
  const [headerConfigDraft, setHeaderConfigDraft] = useState<HeaderConfig>(EMPTY_HEADER_CONFIG);

  // Footer
  const [footer, setFooter] = useState<IB2CStorefrontFooter>({});
  const [footerDraft, setFooterDraft] = useState<IB2CStorefrontFooter>({});

  // SEO
  const [metaTags, setMetaTags] = useState<IB2CStorefrontMetaTags>({});

  // Custom Scripts
  const [customScripts, setCustomScripts] = useState<IB2CCustomScript[]>([]);

  // Custom CSS
  const [customCss, setCustomCss] = useState("");

  // Facets
  const [facetConfig, setFacetConfig] = useState<IB2BPortalFacetConfig | undefined>(undefined);

  // Load languages
  useEffect(() => {
    if (allLanguages.length === 0 && !langsLoading) fetchLanguages();
  }, [allLanguages.length, langsLoading, fetchLanguages]);

  // Load portal
  useEffect(() => {
    fetch(`/api/b2b/b2b/portals/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        // GET returns the portal document at the top level (possibly with synthesized: true).
        if (data && data.slug) {
          const p = data as Portal;
          setPortal(p);
          setSynthesized(p.synthesized === true);
          setName(p.name);
          setChannel(p.channel || "");
          setDomains((p.domains || []).map((d, i) => parseDomainEntry(d, i === 0)));
          setStatus(p.status);
          setDefaultLanguage(p.settings?.default_language || "");
          setBranding(p.branding || {});
          setHeaderConfig(p.header_config || EMPTY_HEADER_CONFIG);
          setHeaderConfigDraft(p.header_config_draft || p.header_config || DEFAULT_B2C_HEADER_CONFIG);
          setFooter(p.footer || {});
          setFooterDraft(p.footer_draft ?? p.footer ?? {});
          setHeaderPubByLang(p.header_config_by_lang || {});
          setHeaderDraftByLang(p.header_config_draft_by_lang || {});
          setFooterPubByLang(p.footer_by_lang || {});
          setFooterDraftByLang(p.footer_draft_by_lang || {});
          setMetaTags(p.meta_tags || {});
          setCustomScripts(p.custom_scripts || []);
          setCustomCss(p.custom_css || "");
          setFacetConfig(p.facet_config);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  /** Apply a PATCH to the portal; returns true on success. Handles the 409 NOT_MIGRATED write-gate. */
  async function patchPortal(body: Record<string, unknown>, failKey: string): Promise<boolean> {
    setError("");
    setNotMigrated(false);
    try {
      const res = await fetch(`/api/b2b/b2b/portals/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.code === "NOT_MIGRATED") {
          setNotMigrated(true);
          return false;
        }
        setError(data.error || t(failKey));
        return false;
      }
      if (data.data) setPortal(data.data);
      return true;
    } catch {
      setError(t("pages.b2bPortal.detail.networkError"));
      return false;
    }
  }

  // Default lang edits the base draft; other langs edit their stored slot, or
  // fall back to the base draft as the clone-from-default starting point.
  const activeHeaderDraft = headerLang === DEFAULT_LANG
    ? headerConfigDraft
    : headerDraftByLang[headerLang] ?? headerConfigDraft;
  const activeFooterDraft = footerLang === DEFAULT_LANG
    ? footerDraft
    : footerDraftByLang[footerLang] ?? footerDraft;

  // Active published value for the selected language (mirrors the draft
  // derivation) so the section's "unpublished changes" badge and
  // "Revert to Published" use the ACTIVE language's published config, not the
  // default language's. Unconfigured languages fall back to the default base.
  const activeHeaderPub = headerLang === DEFAULT_LANG
    ? headerConfig
    : headerPubByLang[headerLang] ?? headerConfig;
  const activeFooterPub = footerLang === DEFAULT_LANG
    ? footer
    : footerPubByLang[footerLang] ?? footer;

  function handleHeaderDraftChange(next: HeaderConfig) {
    if (headerLang === DEFAULT_LANG) setHeaderConfigDraft(next);
    else setHeaderDraftByLang((m) => ({ ...m, [headerLang]: next }));
  }
  function handleFooterDraftChange(next: IB2CStorefrontFooter) {
    if (footerLang === DEFAULT_LANG) setFooterDraft(next);
    else setFooterDraftByLang((m) => ({ ...m, [footerLang]: next }));
  }

  // Save all current state
  async function handleSave() {
    setSaving(true);
    setSuccess("");
    try {
      const formattedDomains = domains
        .filter((d) => d.host.trim() !== "")
        .map((d) => ({ domain: formatDomain(d), is_primary: d.is_primary }));

      const ok = await patchPortal(
        {
          name,
          channel: channel || undefined,
          domains: formattedDomains,
          status,
          branding,
          header_config: headerConfig,
          header_config_draft: headerConfigDraft,
          header_config_by_lang: headerPubByLang,
          header_config_draft_by_lang: headerDraftByLang,
          footer,
          footer_draft: footerDraft,
          footer_by_lang: footerPubByLang,
          footer_draft_by_lang: footerDraftByLang,
          meta_tags: metaTags,
          custom_scripts: customScripts,
          custom_css: customCss,
          facet_config: facetConfig,
          settings: { default_language: defaultLanguage || undefined },
        },
        "pages.b2bPortal.detail.failedToUpdate"
      );
      if (ok) {
        setSuccess(t("pages.b2bPortal.detail.updatedSuccess"));
        setTimeout(() => setSuccess(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  // Publish header for the active language: copy draft to published and save.
  async function handlePublishHeader() {
    const patch = headerPublishPatch(headerLang, activeHeaderDraft, headerPubByLang, headerDraftByLang);
    if (headerLang === DEFAULT_LANG) {
      setHeaderConfig(activeHeaderDraft);
    } else {
      setHeaderPubByLang((m) => ({ ...m, [headerLang]: activeHeaderDraft }));
      setHeaderDraftByLang((m) => ({ ...m, [headerLang]: activeHeaderDraft }));
    }
    setSaving(true);
    setSuccess("");
    try {
      const ok = await patchPortal(patch, "pages.b2bPortal.detail.failedToPublishHeader");
      if (ok) {
        setSuccess(t("pages.b2bPortal.detail.headerPublished"));
        setTimeout(() => setSuccess(""), 3000);
      }
    } finally {
      setSaving(false);
    }
  }

  // Publish footer for the active language: copy draft to published and save.
  async function handlePublishFooter() {
    // When publishing, promote footer_html_draft to footer_html
    const published = { ...activeFooterDraft, footer_html: activeFooterDraft.footer_html_draft || undefined };
    const patch = footerPublishPatch(footerLang, published, footerPubByLang, footerDraftByLang);
    if (footerLang === DEFAULT_LANG) {
      setFooter(published);
    } else {
      setFooterPubByLang((m) => ({ ...m, [footerLang]: published }));
      setFooterDraftByLang((m) => ({ ...m, [footerLang]: published }));
    }
    setSaving(true);
    setSuccess("");
    try {
      const ok = await patchPortal(patch, "pages.b2bPortal.detail.failedToPublishFooter");
      if (ok) {
        setSuccess(t("pages.b2bPortal.detail.footerPublished"));
        setTimeout(() => setSuccess(""), 3000);
      }
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!portal) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">{t("pages.b2bPortal.detail.portalNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs
        items={[
          { label: t("nav.b2bPortal.portals"), href: "/b2b/b2b" },
          { label: portal.name },
        ]}
      />

      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{portal.name}</h1>
          <p className="text-sm text-muted-foreground">{t("pages.b2bPortal.detail.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`${tenantPrefix}/b2b/b2b/portals/${slug}/pages`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/90 hover:bg-muted/50 transition-colors"
          >
            <FileText className="h-4 w-4" /> {t("nav.b2bPortal.pages")}
          </Link>
          <Link
            href={`${tenantPrefix}/b2b/b2b/portals/${slug}/forms`}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/90 hover:bg-muted/50 transition-colors"
          >
            <Inbox className="h-4 w-4" /> {t("nav.b2bPortal.forms")}
          </Link>
          <Link
            href={`${tenantPrefix}/b2b/b2b-home-builder?portal=${slug}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Pencil className="h-4 w-4" /> {t("pages.b2bPortal.detail.homeBuilder")}
          </Link>
        </div>
      </div>

      {/* Synthesized preview banner (unmigrated tenant) */}
      {synthesized && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("pages.b2bPortal.detail.synthesizedBanner")}
        </div>
      )}

      {/* Feedback */}
      {notMigrated && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <p className="font-medium text-amber-800">{t("errors.b2bPortal.notMigrated")}</p>
          <p className="mt-1 text-amber-700">{t("pages.b2bPortal.notMigratedHint")}</p>
        </div>
      )}
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
          <div className="space-y-4">
            {enabledLanguages.length > 1 && (
              <LanguageTabs languages={enabledLanguages} active={headerLang} onChange={setHeaderLang} />
            )}
            <HeaderSection
              headerConfig={activeHeaderPub}
              headerConfigDraft={activeHeaderDraft}
              onDraftChange={handleHeaderDraftChange}
              onPublish={handlePublishHeader}
              saving={saving}
              onSave={handleSave}
              channel={channel}
            />
          </div>
        )}

        {activeSection === "footer" && (
          <div className="space-y-4">
            {enabledLanguages.length > 1 && (
              <LanguageTabs languages={enabledLanguages} active={footerLang} onChange={setFooterLang} />
            )}
            <FooterSection
              footer={activeFooterPub}
              footerDraft={activeFooterDraft}
              onDraftChange={handleFooterDraftChange}
              onPublish={handlePublishFooter}
              saving={saving}
              onSave={handleSave}
            />
          </div>
        )}

        {activeSection === "seo" && (
          <SeoSection
            metaTags={metaTags}
            onChange={handleMetaTagChange}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "scripts" && (
          <ScriptsSection
            scripts={customScripts}
            onChange={setCustomScripts}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "css" && (
          <CssSection
            css={customCss}
            onChange={setCustomCss}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "facets" && (
          <FacetsSection
            facetConfig={facetConfig}
            onChange={setFacetConfig}
            saving={saving}
            onSave={handleSave}
          />
        )}

        {activeSection === "sitemap" && (
          <SitemapSection
            storefrontSlug={slug}
            apiBasePath={`/api/b2b/b2b/portals/${slug}/sitemap`}
          />
        )}
      </div>
    </div>
  );
}
