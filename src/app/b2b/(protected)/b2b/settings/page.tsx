"use client";

/**
 * Global B2B settings page — the tenant-wide sections (product-card defaults,
 * CDN credentials, email transport, company info, API keys, image versions)
 * lifted out of the large legacy /b2b/home-settings page.
 *
 * The portal-level sections (branding / header / footer / SEO / scripts /
 * sitemap) now live on the portal detail page (/b2b/b2b/portals/[slug]) and
 * are intentionally NOT here. This page reads & writes the same unchanged
 * /api/b2b/home-settings document, but its save payload includes only the
 * tenant-global fields — the portal-owned fields are left untouched.
 *
 * Section components live in @/components/b2b/settings/* (props in; this page
 * owns the GET-on-mount + POST-on-save). Mirrors the page shell of the
 * Task-3 portal detail page (Breadcrumbs + the (protected)/b2b/ layout chrome).
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Loader2,
  RefreshCcw,
  Save,
  Monitor,
  Cloud,
  Mail,
  Building2,
  Key,
  Image as ImageIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import ImageVersionsSection from "@/components/home-settings/ImageVersionsSection";
import { ProductCardSection, DEFAULT_CARD_STYLE } from "@/components/b2b/settings/ProductCardSection";
import { CdnSection, DEFAULT_CDN_CREDENTIALS } from "@/components/b2b/settings/CdnSection";
import { EmailSection, DEFAULT_SMTP_SETTINGS, DEFAULT_GRAPH_SETTINGS } from "@/components/b2b/settings/EmailSection";
import { CompanySection, DEFAULT_COMPANY_INFO } from "@/components/b2b/settings/CompanySection";
import { ApiKeysSection } from "@/components/b2b/settings/ApiKeysSection";
import type { PreviewVariant } from "@/components/home-settings/ProductCardPreview";
import type {
  CompanyBranding,
  ProductCardStyle,
  CDNCredentials,
  SMTPSettings,
  GraphSettings,
  EmailTransport,
  CompanyContactInfo,
  ImageVersionsSettings,
} from "@/lib/types/home-settings";

type GlobalSection = "product" | "cdn" | "smtp" | "company" | "apikeys" | "image-versions";

const SIDEBAR_ITEMS: { key: GlobalSection; icon: LucideIcon; labelKey: string; descKey: string }[] = [
  { key: "product", icon: Monitor, labelKey: "pages.homeSettings.sidebar.productCards", descKey: "pages.homeSettings.sidebar.productCardsDesc" },
  { key: "cdn", icon: Cloud, labelKey: "pages.homeSettings.sidebar.cdn", descKey: "pages.homeSettings.sidebar.cdnDesc" },
  { key: "smtp", icon: Mail, labelKey: "pages.homeSettings.sidebar.email", descKey: "pages.homeSettings.sidebar.emailDesc" },
  { key: "company", icon: Building2, labelKey: "pages.homeSettings.sidebar.companyInfo", descKey: "pages.homeSettings.sidebar.companyInfoDesc" },
  { key: "apikeys", icon: Key, labelKey: "pages.homeSettings.sidebar.apiKeys", descKey: "pages.homeSettings.sidebar.apiKeysDesc" },
  { key: "image-versions", icon: ImageIcon, labelKey: "pages.homeSettings.sidebar.imageVersions", descKey: "pages.homeSettings.sidebar.imageVersionsDesc" },
];

function isGlobalSection(v: string | null): v is GlobalSection {
  return v === "product" || v === "cdn" || v === "smtp" || v === "company" || v === "apikeys" || v === "image-versions";
}

export default function GlobalB2BSettingsPage() {
  const { t } = useTranslation();
  const searchParams = useSearchParams();
  const sectionParam = searchParams.get("section");
  const [activeSection, setActiveSection] = useState<GlobalSection>(isGlobalSection(sectionParam) ? sectionParam : "product");

  // Settings state (only the tenant-global slices; the portal-owned slices are
  // not loaded here — branding is the one exception, read-only for the preview).
  const [branding, setBranding] = useState<CompanyBranding>({ title: "" });
  const [cardVariant, setCardVariant] = useState<PreviewVariant>("b2b");
  const [cardStyle, setCardStyle] = useState<ProductCardStyle>(DEFAULT_CARD_STYLE);
  const [cdnCredentials, setCdnCredentials] = useState<CDNCredentials>(DEFAULT_CDN_CREDENTIALS);
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>(DEFAULT_SMTP_SETTINGS);
  const [emailTransport, setEmailTransport] = useState<EmailTransport>("smtp");
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [companyInfo, setCompanyInfo] = useState<CompanyContactInfo>(DEFAULT_COMPANY_INFO);
  const [imageVersions, setImageVersions] = useState<ImageVersionsSettings>({ enabled: true, versions: [] });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch the settings document and populate only the tenant-global slices
  // (plus branding, read-only, for the product-card preview).
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/b2b/home-settings", { cache: "no-store" });
      if (res.status === 404) return; // no settings yet — keep defaults
      if (!res.ok) throw new Error("load-failed");
      const data = await res.json();
      if (data.branding) setBranding({ title: "", ...data.branding });
      setCardVariant((data.defaultCardVariant as PreviewVariant) || "b2b");
      if (data.cardStyle) setCardStyle({ ...DEFAULT_CARD_STYLE, ...data.cardStyle });
      if (data.cdn_credentials) setCdnCredentials({ ...DEFAULT_CDN_CREDENTIALS, ...data.cdn_credentials });
      if (data.smtp_settings) setSmtpSettings({ ...DEFAULT_SMTP_SETTINGS, ...data.smtp_settings });
      if (data.email_transport) setEmailTransport(data.email_transport);
      if (data.graph_settings) setGraphSettings({ ...DEFAULT_GRAPH_SETTINGS, ...data.graph_settings });
      if (data.company_info) setCompanyInfo({ ...DEFAULT_COMPANY_INFO, ...data.company_info });
      if (data.image_versions) setImageVersions(data.image_versions);
      setDirty(false);
    } catch {
      setError(t("pages.b2bSettings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Save — only the tenant-global fields. branding / headerConfig* / footerHtml*
  // / meta_tags are owned by the portal detail page and intentionally omitted.
  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/b2b/home-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCardVariant: cardVariant,
          cardStyle,
          cdn_credentials: cdnCredentials,
          smtp_settings: smtpSettings,
          email_transport: emailTransport,
          graph_settings: graphSettings,
          company_info: companyInfo,
          image_versions: imageVersions,
          lastModifiedBy: "admin",
        }),
      });
      if (!res.ok) throw new Error("save-failed");
      setDirty(false);
      setSuccess(t("pages.b2bSettings.saved"));
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError(t("pages.b2bSettings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const updateCardStyle = <K extends keyof ProductCardStyle>(key: K, value: ProductCardStyle[K]) => {
    setCardStyle((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const updateCdn = <K extends keyof CDNCredentials>(key: K, value: CDNCredentials[K]) => {
    setCdnCredentials((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const updateSmtp = <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => {
    setSmtpSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const updateGraph = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setGraphSettings((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };
  const updateCompany = <K extends keyof CompanyContactInfo>(key: K, value: CompanyContactInfo[K]) => {
    setCompanyInfo((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#009688] border-t-transparent" />
      </div>
    );
  }

  // The API-keys section owns its own persistence (its create/toggle/delete
  // calls hit /api/b2b/api-keys directly), so it gets no page-level Save bar.
  // Every other section is backed by /api/b2b/home-settings and uses the Save bar.
  const showSaveBar = activeSection !== "apikeys";

  return (
    <div className="p-6 space-y-6">
      <Breadcrumbs items={[{ label: t("nav.b2bPortal.portals"), href: "/b2b/b2b" }, { label: t("pages.b2bSettings.title") }]} />

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{t("pages.b2bSettings.title")}</h1>
          <p className="text-sm text-slate-400">{t("pages.b2bSettings.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {t("pages.homeSettings.unsavedChanges")}
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {t("pages.homeSettings.synced")}
            </span>
          )}
        </div>
      </div>

      {/* Feedback */}
      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">{success}</div>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
          <nav className="space-y-2">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveSection(item.key)}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-left transition-all",
                    active
                      ? "border-[#009688] bg-[#009688]/10 text-[#009688] shadow-sm"
                      : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-800"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-xl border",
                        active
                          ? "border-[#009688]/30 bg-[#009688]/15 text-[#009688]"
                          : "border-slate-200 bg-white text-slate-500"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{t(item.labelKey)}</div>
                      <div className="text-xs text-slate-500">{t(item.descKey)}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active section */}
        <main className="flex-1 space-y-6">
          {activeSection === "product" && (
            <ProductCardSection
              cardStyle={cardStyle}
              cardVariant={cardVariant}
              onVariantChange={(v) => {
                setCardVariant(v);
                setDirty(true);
              }}
              onStyleChange={updateCardStyle}
              branding={branding}
            />
          )}

          {activeSection === "cdn" && (
            <CdnSection cdnCredentials={cdnCredentials} onChange={updateCdn} hasUnsavedChanges={dirty} />
          )}

          {activeSection === "smtp" && (
            <EmailSection
              emailTransport={emailTransport}
              onTransportChange={(tr) => {
                setEmailTransport(tr);
                setDirty(true);
              }}
              smtpSettings={smtpSettings}
              onSmtpChange={updateSmtp}
              graphSettings={graphSettings}
              onGraphChange={updateGraph}
            />
          )}

          {activeSection === "company" && <CompanySection companyInfo={companyInfo} onChange={updateCompany} />}

          {activeSection === "apikeys" && <ApiKeysSection />}

          {activeSection === "image-versions" && (
            <ImageVersionsSection
              value={imageVersions}
              onChange={(val) => {
                setImageVersions(val);
                setDirty(true);
              }}
            />
          )}

          {/* Save bar — for every section backed by /api/b2b/home-settings. */}
          {showSaveBar && (
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <Button variant="outline" size="sm" onClick={() => loadSettings()} disabled={saving} className="gap-2">
                <RefreshCcw className="h-4 w-4" /> {t("pages.homeSettings.reload")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || !dirty}
                className="gap-2 bg-[#009688] px-5 text-white hover:bg-[#00796b]"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> {t("pages.homeSettings.saving")}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" /> {t("pages.homeSettings.saveChanges")}
                  </>
                )}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
