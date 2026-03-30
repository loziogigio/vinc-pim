"use client";

import { useEffect, useMemo, useState, useRef, useCallback, ChangeEvent } from "react";
import {
  Cloud,
  Eye,
  Loader2,
  Mail,
  Monitor,
  Palette,
  RefreshCcw,
  Save,
  Upload,
  Key,
  Copy,
  Check,
  Trash2,
  Plus,
  AlertTriangle,
  FileCode2,
  Send,
  LayoutTemplate,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Lock,
  Unlock,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Image,
  Search,
  Radio,
  Menu,
  ShoppingCart,
  Building2,
  EyeOff,
  Heart,
  GitCompare,
  User,
  Square,
  Space,
  Minus,
  Settings2,
  Globe,
  X,
  Bell,
  History,
  LayoutGrid,
  Store
} from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { AccordionItem, AccordionGroup } from "@/components/ui/accordion";
import { cn } from "@/components/ui/utils";
import ProductCardPreview, { type PreviewVariant } from "@/components/home-settings/ProductCardPreview";
import type { CompanyBranding, ProductCardStyle, CDNCredentials, SMTPSettings, GraphSettings, EmailTransport, CompanyContactInfo, HeaderConfig, HeaderRow, HeaderBlock, HeaderWidget, RowLayout, HeaderWidgetType, BlockAlignment, MetaTags, RadioStation, ImageVersionsSettings } from "@/lib/types/home-settings";
import ImageVersionsSection from "@/components/home-settings/ImageVersionsSection";
import { LAYOUT_WIDTHS, LAYOUT_BLOCK_COUNT, HEADER_WIDGET_LIBRARY } from "@/lib/types/home-settings";
import { useImageUpload, type UploadState } from "@/hooks/useImageUpload";
import { useTranslation } from "@/lib/i18n/useTranslation";

const DEFAULT_BRANDING: CompanyBranding = {
  title: "My Company",
  logo: "",
  favicon: "",
  primaryColor: "#009f7f",
  secondaryColor: "#02b290",
  shopUrl: "",
  websiteUrl: "",
  // Extended theming colors
  accentColor: "",
  textColor: "#000000",
  mutedColor: "#595959",
  backgroundColor: "#ffffff",
  headerBackgroundColor: "",
  footerBackgroundColor: "#f5f5f5",
  footerTextColor: "#666666"
};

const DEFAULT_CARD_STYLE: ProductCardStyle = {
  borderWidth: 1,
  borderColor: "#EAEEF2",
  borderStyle: "solid",
  shadowSize: "none",
  shadowColor: "rgba(0, 0, 0, 0.1)",
  borderRadius: "md",
  hoverEffect: "none",
  hoverScale: 1.02,
  hoverShadowSize: "lg",
  backgroundColor: "#ffffff",
  hoverBackgroundColor: undefined
};

const CARD_VARIANTS: Array<{ value: PreviewVariant; labelKey: string; helperKey: string }> = [
  {
    value: "b2b",
    labelKey: "pages.homeSettings.product.variantVertical",
    helperKey: "pages.homeSettings.product.variantVerticalHelper"
  },
  {
    value: "horizontal",
    labelKey: "pages.homeSettings.product.variantHorizontal",
    helperKey: "pages.homeSettings.product.variantHorizontalHelper"
  }
];

type ActiveSection = "branding" | "product" | "cdn" | "smtp" | "company" | "apikeys" | "footer" | "header" | "seo" | "vetrina" | "image-versions";

const DEFAULT_CDN_CREDENTIALS: CDNCredentials = {
  cdn_url: "",
  bucket_region: "",
  bucket_name: "",
  folder_name: "",
  cdn_key: "",
  cdn_secret: "",
  signed_url_expiry: 0,
  delete_from_cloud: false
};

const DEFAULT_SMTP_SETTINGS: SMTPSettings = {
  host: "",
  port: 587,
  secure: false,
  user: "",
  password: "",
  from: "",
  from_name: "",
  default_to: ""
};

const DEFAULT_GRAPH_SETTINGS: GraphSettings = {
  client_id: "",
  azure_tenant_id: "",
  client_secret: "",
  sender_email: "",
  sender_name: "",
  save_to_sent_items: false
};

const DEFAULT_COMPANY_INFO: CompanyContactInfo = {
  legal_name: "",
  address_line1: "",
  address_line2: "",
  phone: "",
  email: "",
  support_email: "",
  business_hours: "",
  vat_number: ""
};

const DEFAULT_HEADER_CONFIG: HeaderConfig = {
  rows: [
    {
      id: "main",
      enabled: true,
      fixed: true,
      backgroundColor: "#ffffff",
      layout: "20-60-20",
      blocks: [
        {
          id: "left",
          alignment: "left",
          widgets: [
            { id: "logo", type: "logo", config: {} }
          ]
        },
        {
          id: "center",
          alignment: "center",
          widgets: [
            { id: "search", type: "search-bar", config: { width: "lg" } },
            { id: "radio", type: "radio-widget", config: {
              enabled: false,
              headerIcon: "",
              stations: [
                { id: "station-rtl", name: "RTL 102.5", logoUrl: "", streamUrl: "https://streamingv2.shoutcast.com/rtl-102-5" },
                { id: "station-rds", name: "RDS", logoUrl: "", streamUrl: "https://icstream.rds.radio/rds" }
              ]
            } }
          ]
        },
        {
          id: "right",
          alignment: "right",
          widgets: [
            { id: "no-price", type: "no-price", config: {} },
            { id: "favorites", type: "favorites", config: {} },
            { id: "compare", type: "compare", config: {} },
            { id: "profile", type: "profile", config: {} },
            { id: "cart", type: "cart", config: {} }
          ]
        }
      ]
    },
    {
      id: "nav",
      enabled: true,
      fixed: true,
      backgroundColor: "#f8fafc",
      layout: "50-50",
      blocks: [
        {
          id: "left",
          alignment: "left",
          widgets: [
            { id: "categories", type: "category-menu", config: { label: "Categorie" } },
            { id: "promo-btn", type: "button", config: { label: "Promozioni", url: "/promotions", variant: "primary" } },
            { id: "new-btn", type: "button", config: { label: "Nuovi arrivi", url: "/new-arrivals", variant: "secondary" } }
          ]
        },
        {
          id: "right",
          alignment: "right",
          widgets: [
            { id: "orders-btn", type: "button", config: { label: "i miei ordini", url: "/orders", variant: "outline" } },
            { id: "docs-btn", type: "button", config: { label: "i miei documenti", url: "/documents", variant: "outline" } },
            { id: "delivery", type: "company-info", config: { showDeliveryAddress: true } }
          ]
        }
      ]
    }
  ]
};

const DEFAULT_META_TAGS: MetaTags = {
  title: "",
  description: "",
  keywords: "",
  author: "",
  robots: "index, follow",
  canonicalUrl: "",
  ogTitle: "",
  ogDescription: "",
  ogImage: "",
  ogSiteName: "",
  ogType: "website",
  twitterCard: "summary_large_image",
  twitterSite: "",
  twitterCreator: "",
  twitterImage: "",
  structuredData: "",
  themeColor: "",
  googleSiteVerification: "",
  bingSiteVerification: ""
};

interface BrandingFormProps {
  branding: CompanyBranding;
  onChange: (key: keyof CompanyBranding, value: string) => void;
  onUploadLogo: (file: File) => Promise<void>;
  onUploadFavicon: (file: File) => Promise<void>;
  logoUpload: UploadState;
  faviconUpload: UploadState;
}

interface CardStyleFormProps {
  cardStyle: ProductCardStyle;
  cardVariant: PreviewVariant;
  onVariantChange: (variant: PreviewVariant) => void;
  onStyleChange: <K extends keyof ProductCardStyle>(key: K, value: ProductCardStyle[K]) => void;
}

interface MetaTagsFormProps {
  metaTags: MetaTags;
  onChange: (key: keyof MetaTags, value: string) => void;
}

const SectionCard: React.FC<{ title: string; description: string; children: React.ReactNode }> = ({
  title,
  description,
  children
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-6 py-5">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="text-sm text-slate-500">{description}</p>
    </div>
    <div className="space-y-6 px-6 py-6">{children}</div>
  </div>
);

const ColorInput = ({
  id,
  label,
  value,
  onChange,
  helper,
  allowClear,
  onClear,
  clearLabel
}: {
  id: string;
  label: string;
  value?: string;
  helper?: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
  onClear?: () => void;
  clearLabel?: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <label htmlFor={id} className="text-sm font-medium text-slate-600">
        {label}
      </label>
      {allowClear && value && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-slate-500 hover:text-slate-700"
        >
          {clearLabel || "Clear"}
        </button>
      )}
    </div>
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="color"
        value={value || "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-12 cursor-pointer rounded-md border border-slate-200 bg-white"
      />
      <input
        type="text"
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        placeholder="#FFFFFF"
        className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </div>
    {helper ? <p className="text-xs text-slate-500">{helper}</p> : null}
  </div>
);

export default function HomeSettingsPage() {
  const { t } = useTranslation();
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [cardVariant, setCardVariant] = useState<PreviewVariant>("b2b");
  const [cardStyle, setCardStyle] = useState<ProductCardStyle>(DEFAULT_CARD_STYLE);
  const [cdnCredentials, setCdnCredentials] = useState<CDNCredentials>(DEFAULT_CDN_CREDENTIALS);
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>(DEFAULT_SMTP_SETTINGS);
  const [emailTransport, setEmailTransport] = useState<EmailTransport>("smtp");
  const [graphSettings, setGraphSettings] = useState<GraphSettings>(DEFAULT_GRAPH_SETTINGS);
  const [companyInfo, setCompanyInfo] = useState<CompanyContactInfo>(DEFAULT_COMPANY_INFO);
  const [footerHtml, setFooterHtml] = useState<string>("");
  const [footerHtmlDraft, setFooterHtmlDraft] = useState<string>("");
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [headerConfigDraft, setHeaderConfigDraft] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [metaTags, setMetaTags] = useState<MetaTags>(DEFAULT_META_TAGS);
  const [imageVersions, setImageVersions] = useState<ImageVersionsSettings>({ enabled: true, versions: [] });
  const [activeSection, setActiveSection] = useState<ActiveSection>("branding");
  const [previewVariant, setPreviewVariant] = useState<PreviewVariant>("b2b");

  const [isLoading, setIsLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const logoUploader = useImageUpload();
  const faviconUploader = useImageUpload();

  // Vetrina listing state
  const [vetrinaListed, setVetrinaListed] = useState(false);
  const [vetrinaLoading, setVetrinaLoading] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/b2b/home-settings`, {
        cache: "no-store"
      });

      if (response.status === 404) {
        setBranding(DEFAULT_BRANDING);
        setCardStyle(DEFAULT_CARD_STYLE);
        setCdnCredentials(DEFAULT_CDN_CREDENTIALS);
        setSmtpSettings(DEFAULT_SMTP_SETTINGS);
        setCompanyInfo(DEFAULT_COMPANY_INFO);
        setFooterHtml("");
        setFooterHtmlDraft("");
        setHeaderConfig(DEFAULT_HEADER_CONFIG);
        setHeaderConfigDraft(DEFAULT_HEADER_CONFIG);
        setMetaTags(DEFAULT_META_TAGS);
        setCardVariant("b2b");
        setPreviewVariant("b2b");
        setDirty(false);
        setToast(t("pages.homeSettings.toasts.noSettingsFound"));
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load settings");
      }

      const data = await response.json();

      setBranding({
        ...DEFAULT_BRANDING,
        ...(data.branding ?? {})
      });
      const resolvedVariant = (data.defaultCardVariant as PreviewVariant) || "b2b";
      setCardVariant(resolvedVariant);
      setPreviewVariant(resolvedVariant);
      setCardStyle({
        ...DEFAULT_CARD_STYLE,
        ...(data.cardStyle ?? {})
      });
      setCdnCredentials({
        ...DEFAULT_CDN_CREDENTIALS,
        ...(data.cdn_credentials ?? {})
      });
      setSmtpSettings({
        ...DEFAULT_SMTP_SETTINGS,
        ...(data.smtp_settings ?? {})
      });
      setEmailTransport(data.email_transport || "smtp");
      setGraphSettings({
        ...DEFAULT_GRAPH_SETTINGS,
        ...(data.graph_settings ?? {})
      });
      setCompanyInfo({
        ...DEFAULT_COMPANY_INFO,
        ...(data.company_info ?? {})
      });
      setFooterHtml(data.footerHtml || "");
      setFooterHtmlDraft(data.footerHtmlDraft || data.footerHtml || "");
      setHeaderConfig(data.headerConfig || DEFAULT_HEADER_CONFIG);
      setHeaderConfigDraft(data.headerConfigDraft || data.headerConfig || DEFAULT_HEADER_CONFIG);
      setMetaTags({
        ...DEFAULT_META_TAGS,
        ...(data.meta_tags ?? {})
      });
      if (data.image_versions) {
        setImageVersions(data.image_versions);
      }
      setDirty(false);
      setToast(t("pages.homeSettings.toasts.settingsLoaded"));
    } catch (loadError) {
      console.error("Error loading settings:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Failed to load settings.");
    } finally {
      setIsLoading(false);
      setHasLoadedOnce(true);
    }
  };

  useEffect(() => {
    loadSettings();
    // Load vetrina status
    fetch("/api/b2b/vetrina/status")
      .then(res => res.json())
      .then(data => {
        if (data.success) setVetrinaListed(data.is_listed);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  const updateBranding = (key: keyof CompanyBranding, value: string) => {
    setBranding((prev: CompanyBranding) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleLogoUpload = useCallback(
    async (file: File) => {
      logoUploader.resetError();
      const url = await logoUploader.uploadImage(file);
      if (url) {
        updateBranding("logo", url);
      }
    },
    [logoUploader, updateBranding]
  );

  const handleFaviconUpload = useCallback(
    async (file: File) => {
      faviconUploader.resetError();
      const url = await faviconUploader.uploadImage(file);
      if (url) {
        updateBranding("favicon", url);
      }
    },
    [faviconUploader, updateBranding]
  );

  const updateCardStyle = <K extends keyof ProductCardStyle>(key: K, value: ProductCardStyle[K]) => {
    setCardStyle((prev: ProductCardStyle) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateCdnCredentials = <K extends keyof CDNCredentials>(key: K, value: CDNCredentials[K]) => {
    setCdnCredentials((prev: CDNCredentials) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateSmtpSettings = <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => {
    setSmtpSettings((prev: SMTPSettings) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateEmailTransport = (transport: EmailTransport) => {
    setEmailTransport(transport);
    setDirty(true);
  };

  const updateGraphSettings = <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => {
    setGraphSettings((prev: GraphSettings) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const updateCompanyInfo = <K extends keyof CompanyContactInfo>(key: K, value: CompanyContactInfo[K]) => {
    setCompanyInfo((prev: CompanyContactInfo) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/b2b/home-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branding,
          defaultCardVariant: cardVariant,
          cardStyle,
          cdn_credentials: cdnCredentials,
          smtp_settings: smtpSettings,
          email_transport: emailTransport,
          graph_settings: graphSettings,
          company_info: companyInfo,
          footerHtmlDraft,
          headerConfigDraft,
          meta_tags: metaTags,
          image_versions: imageVersions,
          lastModifiedBy: "admin"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setDirty(false);
      setToast(t("pages.homeSettings.toasts.settingsSaved"));
    } catch (saveError) {
      console.error("Error saving settings:", saveError);
      setError(saveError instanceof Error ? saveError.message : "Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    setPreviewVariant(cardVariant);
  }, [cardVariant]);

  const handleVetrinaSave = async () => {
    setVetrinaLoading(true);
    try {
      const res = await fetch("/api/b2b/vetrina/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_listed: vetrinaListed }),
      });
      if (res.ok) {
        setToast(t("pages.homeSettings.toasts.vetrinaUpdated"));
      } else {
        setError(t("pages.homeSettings.toasts.vetrinaFailed"));
      }
    } catch {
      setError(t("pages.homeSettings.toasts.vetrinaFailed"));
    } finally {
      setVetrinaLoading(false);
    }
  };

  const showInitialLoader = isLoading && !hasLoadedOnce;

  return showInitialLoader ? (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-slate-700">{t("pages.homeSettings.loadingSettings")}</span>
      </div>
    </div>
  ) : (
    <>
      {/* Sub-header with page title and actions */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">{t("pages.homeSettings.pageTitle")}</h1>
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
            <p className="text-sm text-slate-500">
              {t("pages.homeSettings.pageDescription")}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadSettings()}
              disabled={isSaving}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              {t("pages.homeSettings.reload")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-slate-500 hover:text-slate-900"
              onClick={() => {
                const url = branding.shopUrl || "/preview?slug=home";
                window.open(url, "_blank", "noreferrer");
              }}
              disabled={!branding.shopUrl}
              title={branding.shopUrl || t("pages.homeSettings.setShopUrlHint")}
            >
              <Eye className="h-4 w-4" />
              {t("pages.homeSettings.previewStorefront")}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !dirty}
              className="gap-2 bg-primary px-5 text-white hover:bg-primary/90"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages.homeSettings.saving")}
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  {t("pages.homeSettings.saveChanges")}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mx-auto mt-4 w-full max-w-[1500px] px-6">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm">
            {error}
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="mx-auto mt-4 w-full max-w-[1500px] px-6">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-sm">
            {toast}
          </div>
        </div>
      ) : null}

      <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col gap-6 px-6 py-8 lg:flex-row">
        <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
          <nav className="space-y-2">
            <SidebarItem
              icon={Palette}
              label={t("pages.homeSettings.sidebar.branding")}
              description={t("pages.homeSettings.sidebar.brandingDesc")}
              active={activeSection === "branding"}
              onClick={() => setActiveSection("branding")}
            />
            <SidebarItem
              icon={Monitor}
              label={t("pages.homeSettings.sidebar.productCards")}
              description={t("pages.homeSettings.sidebar.productCardsDesc")}
              active={activeSection === "product"}
              onClick={() => setActiveSection("product")}
            />
            <SidebarItem
              icon={Cloud}
              label={t("pages.homeSettings.sidebar.cdn")}
              description={t("pages.homeSettings.sidebar.cdnDesc")}
              active={activeSection === "cdn"}
              onClick={() => setActiveSection("cdn")}
            />
            <SidebarItem
              icon={Mail}
              label={t("pages.homeSettings.sidebar.email")}
              description={t("pages.homeSettings.sidebar.emailDesc")}
              active={activeSection === "smtp"}
              onClick={() => setActiveSection("smtp")}
            />
            <SidebarItem
              icon={Building2}
              label={t("pages.homeSettings.sidebar.companyInfo")}
              description={t("pages.homeSettings.sidebar.companyInfoDesc")}
              active={activeSection === "company"}
              onClick={() => setActiveSection("company")}
            />
            <SidebarItem
              icon={Key}
              label={t("pages.homeSettings.sidebar.apiKeys")}
              description={t("pages.homeSettings.sidebar.apiKeysDesc")}
              active={activeSection === "apikeys"}
              onClick={() => setActiveSection("apikeys")}
            />
            <SidebarItem
              icon={FileCode2}
              label={t("pages.homeSettings.sidebar.footer")}
              description={t("pages.homeSettings.sidebar.footerDesc")}
              active={activeSection === "footer"}
              onClick={() => setActiveSection("footer")}
            />
            <SidebarItem
              icon={LayoutTemplate}
              label={t("pages.homeSettings.sidebar.header")}
              description={t("pages.homeSettings.sidebar.headerDesc")}
              active={activeSection === "header"}
              onClick={() => setActiveSection("header")}
            />
            <SidebarItem
              icon={Globe}
              label={t("pages.homeSettings.sidebar.seo")}
              description={t("pages.homeSettings.sidebar.seoDesc")}
              active={activeSection === "seo"}
              onClick={() => setActiveSection("seo")}
            />
            <SidebarItem
              icon={Image}
              label={t("pages.homeSettings.sidebar.imageVersions")}
              description={t("pages.homeSettings.sidebar.imageVersionsDesc")}
              active={activeSection === "image-versions"}
              onClick={() => setActiveSection("image-versions")}
            />
            <SidebarItem
              icon={Store}
              label={t("pages.homeSettings.sidebar.vetrina")}
              description={t("pages.homeSettings.sidebar.vetrinaDesc")}
              active={activeSection === "vetrina"}
              onClick={() => setActiveSection("vetrina")}
            />
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
          {activeSection === "branding" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <BrandingForm
                  branding={branding}
                  onChange={updateBranding}
                  onUploadLogo={handleLogoUpload}
                  onUploadFavicon={handleFaviconUpload}
                  logoUpload={logoUploader.uploadState}
                  faviconUpload={faviconUploader.uploadState}
                />
              </div>
              <div className="xl:col-span-1">
                <BrandingPreview branding={branding} cardStyle={cardStyle} />
              </div>
            </div>
          )}
          {activeSection === "product" && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <CardStyleForm
                  cardStyle={cardStyle}
                  cardVariant={cardVariant}
                  onVariantChange={(variant) => {
                    setCardVariant(variant);
                    setDirty(true);
                  }}
                  onStyleChange={updateCardStyle}
                />
              </div>
              <div className="xl:col-span-1">
                <ProductCardPreviewPanel
                  cardStyle={cardStyle}
                  branding={branding}
                  previewVariant={previewVariant}
                  onVariantChange={setPreviewVariant}
                />
              </div>
            </div>
          )}
          {activeSection === "cdn" && (
            <CDNForm
              cdnCredentials={cdnCredentials}
              onChange={updateCdnCredentials}
              hasUnsavedChanges={dirty}
            />
          )}
          {activeSection === "smtp" && (
            <EmailSettingsForm
              emailTransport={emailTransport}
              onTransportChange={updateEmailTransport}
              smtpSettings={smtpSettings}
              onSmtpChange={updateSmtpSettings}
              graphSettings={graphSettings}
              onGraphChange={updateGraphSettings}
            />
          )}
          {activeSection === "company" && (
            <CompanyInfoForm
              companyInfo={companyInfo}
              onChange={updateCompanyInfo}
            />
          )}
          {activeSection === "apikeys" && <APIKeysForm />}
          {activeSection === "footer" && (
            <FooterForm
              footerHtml={footerHtml}
              footerHtmlDraft={footerHtmlDraft}
              branding={branding}
              onDraftChange={(html) => {
                setFooterHtmlDraft(html);
                setDirty(true);
              }}
              onPublish={async () => {
                // Save draft as published
                const response = await fetch("/api/b2b/home-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    footerHtml: footerHtmlDraft,
                    footerHtmlDraft,
                    lastModifiedBy: "admin"
                  })
                });
                if (response.ok) {
                  setFooterHtml(footerHtmlDraft);
                  setToast(t("pages.homeSettings.toasts.footerPublished"));
                }
              }}
            />
          )}
          {activeSection === "header" && (
            <HeaderForm
              headerConfig={headerConfig}
              headerConfigDraft={headerConfigDraft}
              branding={branding}
              onDraftChange={(config) => {
                setHeaderConfigDraft(config);
                setDirty(true);
              }}
              onPublish={async () => {
                const response = await fetch("/api/b2b/home-settings", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    headerConfig: headerConfigDraft,
                    headerConfigDraft,
                    lastModifiedBy: "admin"
                  })
                });
                if (response.ok) {
                  setHeaderConfig(headerConfigDraft);
                  setToast(t("pages.homeSettings.toasts.headerPublished"));
                }
              }}
            />
          )}
          {activeSection === "seo" && (
            <MetaTagsForm
              metaTags={metaTags}
              onChange={(key, value) => {
                setMetaTags(prev => ({ ...prev, [key]: value }));
                setDirty(true);
              }}
            />
          )}

          {activeSection === "image-versions" && (
            <ImageVersionsSection
              value={imageVersions}
              onChange={(val) => {
                setImageVersions(val);
                setDirty(true);
              }}
            />
          )}

          {activeSection === "vetrina" && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" />
                  {t("pages.homeSettings.vetrina.title")}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {t("pages.homeSettings.vetrina.description")}
                </p>
              </div>
              <div className="px-6 py-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t("pages.homeSettings.vetrina.listInVetrina")}</p>
                    <p className="text-xs text-slate-500">
                      {t("pages.homeSettings.vetrina.listInVetrinaDesc")}
                    </p>
                  </div>
                  <button
                    onClick={() => setVetrinaListed(!vetrinaListed)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      vetrinaListed ? "bg-primary" : "bg-slate-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        vetrinaListed ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleVetrinaSave}
                    disabled={vetrinaLoading}
                    className="gap-2"
                  >
                    {vetrinaLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("pages.homeSettings.saving")}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {t("pages.homeSettings.vetrina.saveVetrina")}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  description,
  active,
  onClick
}: {
  icon: typeof Palette;
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition-all",
        active
          ? "border-primary bg-primary/10 text-primary shadow-sm"
          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-800"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border",
            active
              ? "border-primary/30 bg-primary/15 text-primary"
              : "border-slate-200 bg-white text-slate-500"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="text-xs text-slate-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

function BrandingForm({
  branding,
  onChange,
  onUploadLogo,
  onUploadFavicon,
  logoUpload,
  faviconUpload
}: BrandingFormProps) {
  const { t } = useTranslation();
  const logoInputRef = useRef<HTMLInputElement | null>(null);
  const faviconInputRef = useRef<HTMLInputElement | null>(null);

  const handleLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await onUploadLogo(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleFaviconChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      await onUploadFavicon(file);
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  return (
    <SectionCard
      title={t("pages.homeSettings.branding.title")}
      description={t("pages.homeSettings.branding.description")}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="company-title" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.branding.companyTitle")}
          </label>
          <input
            id="company-title"
            type="text"
            value={branding.title}
            onChange={(event) => onChange("title", event.target.value)}
            placeholder="HidrosPoint"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.branding.companyTitleHelper")}
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-600">{t("pages.homeSettings.branding.logo")}</label>
              <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.logoHelper")}</p>
            </div>
            {branding.logo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-rose-600"
                onClick={() => onChange("logo", "")}
              >
                {t("common.remove")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt={t("pages.homeSettings.branding.logoPreview")} className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs font-semibold uppercase text-slate-400">{t("pages.homeSettings.branding.logo")}</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUpload.isUploading}
              >
                {logoUpload.isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {logoUpload.isUploading ? t("pages.homeSettings.branding.uploading") : t("pages.homeSettings.branding.uploadLogo")}
              </Button>
              {logoUpload.error ? (
                <p className="text-xs text-rose-600">{logoUpload.error}</p>
              ) : null}
            </div>
          </div>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-600">{t("pages.homeSettings.branding.favicon")}</label>
              <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.faviconHelper")}</p>
            </div>
            {branding.favicon ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-rose-600"
                onClick={() => onChange("favicon", "")}
              >
                {t("common.remove")}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
              {branding.favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.favicon} alt={t("pages.homeSettings.branding.faviconPreview")} className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-semibold uppercase text-slate-400">ICO</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                size="sm"
                className="gap-2"
                onClick={() => faviconInputRef.current?.click()}
                disabled={faviconUpload.isUploading}
              >
                {faviconUpload.isUploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {faviconUpload.isUploading ? t("pages.homeSettings.branding.uploading") : t("pages.homeSettings.branding.uploadFavicon")}
              </Button>
              {faviconUpload.error ? (
                <p className="text-xs text-rose-600">{faviconUpload.error}</p>
              ) : null}
            </div>
          </div>
          <input
            ref={faviconInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFaviconChange}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="logo-url" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.branding.logoUrl")}
          </label>
          <input
            id="logo-url"
            type="text"
            value={branding.logo || ""}
            onChange={(event) => onChange("logo", event.target.value)}
            placeholder="https://example.com/logo.svg"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.logoUrlHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="favicon-url" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.branding.faviconUrl")}
          </label>
          <input
            id="favicon-url"
            type="text"
            value={branding.favicon || ""}
            onChange={(event) => onChange("favicon", event.target.value)}
            placeholder="https://example.com/favicon.ico"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.faviconUrlHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="shop-url" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.branding.shopUrl")}
          </label>
          <input
            id="shop-url"
            type="url"
            value={branding.shopUrl || ""}
            onChange={(event) => onChange("shopUrl", event.target.value)}
            placeholder="https://shop.example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.shopUrlHelper")}</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="website-url" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.branding.companyWebsite")}
          </label>
          <input
            id="website-url"
            type="url"
            value={branding.websiteUrl || ""}
            onChange={(event) => onChange("websiteUrl", event.target.value)}
            placeholder="https://www.example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.branding.companyWebsiteHelper")}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ColorInput
          id="primary-color"
          label={t("pages.homeSettings.branding.primaryColor")}
          value={branding.primaryColor}
          onChange={(value) => onChange("primaryColor", value)}
          helper={t("pages.homeSettings.branding.primaryColorHelper")}
        />
        <ColorInput
          id="secondary-color"
          label={t("pages.homeSettings.branding.secondaryColor")}
          value={branding.secondaryColor}
          onChange={(value) => onChange("secondaryColor", value)}
          helper={t("pages.homeSettings.branding.secondaryColorHelper")}
        />
      </div>

      {/* Extended Theme Colours */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900">
          <Palette className="h-4 w-4" />
          {t("pages.homeSettings.branding.extendedTheme")}
          <span className="ml-auto text-xs text-slate-400 group-open:hidden">{t("pages.homeSettings.branding.clickToExpand")}</span>
        </summary>
        <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
          <ColorInput
            id="accent-color"
            label={t("pages.homeSettings.branding.accentColor")}
            value={branding.accentColor}
            onChange={(value) => onChange("accentColor", value)}
            helper={t("pages.homeSettings.branding.accentColorHelper")}
            allowClear
            onClear={() => onChange("accentColor", "")}
          />
          <ColorInput
            id="text-color"
            label={t("pages.homeSettings.branding.textColor")}
            value={branding.textColor}
            onChange={(value) => onChange("textColor", value)}
            helper={t("pages.homeSettings.branding.textColorHelper")}
            allowClear
            onClear={() => onChange("textColor", "")}
          />
          <ColorInput
            id="muted-color"
            label={t("pages.homeSettings.branding.mutedColor")}
            value={branding.mutedColor}
            onChange={(value) => onChange("mutedColor", value)}
            helper={t("pages.homeSettings.branding.mutedColorHelper")}
            allowClear
            onClear={() => onChange("mutedColor", "")}
          />
          <ColorInput
            id="background-color"
            label={t("pages.homeSettings.branding.backgroundColor")}
            value={branding.backgroundColor}
            onChange={(value) => onChange("backgroundColor", value)}
            helper={t("pages.homeSettings.branding.backgroundColorHelper")}
            allowClear
            onClear={() => onChange("backgroundColor", "")}
          />
          <ColorInput
            id="header-bg-color"
            label={t("pages.homeSettings.branding.headerBg")}
            value={branding.headerBackgroundColor}
            onChange={(value) => onChange("headerBackgroundColor", value)}
            helper={t("pages.homeSettings.branding.headerBgHelper")}
            allowClear
            onClear={() => onChange("headerBackgroundColor", "")}
          />
          <ColorInput
            id="footer-bg-color"
            label={t("pages.homeSettings.branding.footerBg")}
            value={branding.footerBackgroundColor}
            onChange={(value) => onChange("footerBackgroundColor", value)}
            helper={t("pages.homeSettings.branding.footerBgHelper")}
            allowClear
            onClear={() => onChange("footerBackgroundColor", "")}
          />
          <ColorInput
            id="footer-text-color"
            label={t("pages.homeSettings.branding.footerTextColor")}
            value={branding.footerTextColor}
            onChange={(value) => onChange("footerTextColor", value)}
            helper={t("pages.homeSettings.branding.footerTextColorHelper")}
            allowClear
            onClear={() => onChange("footerTextColor", "")}
          />
        </div>
      </details>
    </SectionCard>
  );
}

function CardStyleForm({
  cardStyle,
  cardVariant,
  onVariantChange,
  onStyleChange
}: CardStyleFormProps) {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("pages.homeSettings.product.title")}
      description={t("pages.homeSettings.product.description")}
    >
      <div className="space-y-4">
        <label className="text-sm font-medium text-slate-600">{t("pages.homeSettings.product.defaultLayout")}</label>
        <div className="grid gap-3 md:grid-cols-2">
          {CARD_VARIANTS.map((variant) => {
            const isActive = cardVariant === variant.value;
            return (
              <button
                key={variant.value}
                type="button"
                onClick={() => onVariantChange(variant.value)}
                className={cn(
                  "rounded-2xl border px-4 py-3 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-slate-200 hover:border-primary/30 hover:bg-primary/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold",
                      isActive
                        ? "border-primary/30 bg-primary/15 text-primary"
                        : "border-slate-200 bg-white text-slate-500"
                    )}
                  >
                    {variant.value === "b2b" ? "V" : "H"}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">{t(variant.labelKey)}</div>
                    <div className="text-xs text-slate-500">{t(variant.helperKey)}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.product.borderWidth")}: {cardStyle.borderWidth}px
          </label>
          <input
            type="range"
            min={0}
            max={4}
            step={1}
            value={cardStyle.borderWidth}
            onChange={(event) => onStyleChange("borderWidth", Number(event.target.value))}
            className="w-full"
          />
        </div>

        <ColorInput
          id="border-color"
          label={t("pages.homeSettings.product.borderColor")}
          value={cardStyle.borderColor}
          onChange={(value) => onStyleChange("borderColor", value)}
        />

        <div className="space-y-2">
          <label htmlFor="border-style" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.product.borderStyle")}
          </label>
          <select
            id="border-style"
            value={cardStyle.borderStyle}
            onChange={(event) =>
              onStyleChange("borderStyle", event.target.value as ProductCardStyle["borderStyle"])
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="solid">{t("pages.homeSettings.product.borderSolid")}</option>
            <option value="dashed">{t("pages.homeSettings.product.borderDashed")}</option>
            <option value="dotted">{t("pages.homeSettings.product.borderDotted")}</option>
            <option value="none">{t("common.none")}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="border-radius" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.product.borderRadius")}
          </label>
          <select
            id="border-radius"
            value={cardStyle.borderRadius}
            onChange={(event) =>
              onStyleChange(
                "borderRadius",
                event.target.value as ProductCardStyle["borderRadius"]
              )
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("pages.homeSettings.product.radiusSharp")}</option>
            <option value="sm">{t("pages.homeSettings.product.radiusSlight")}</option>
            <option value="md">{t("pages.homeSettings.product.radiusMedium")}</option>
            <option value="lg">{t("pages.homeSettings.product.radiusLarge")}</option>
            <option value="xl">{t("pages.homeSettings.product.radiusXl")}</option>
            <option value="2xl">{t("pages.homeSettings.product.radiusPill")}</option>
            <option value="full">{t("pages.homeSettings.product.radiusCircle")}</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="shadow-size" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.product.shadowSize")}
          </label>
          <select
            id="shadow-size"
            value={cardStyle.shadowSize}
            onChange={(event) =>
              onStyleChange("shadowSize", event.target.value as ProductCardStyle["shadowSize"])
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("common.none")}</option>
            <option value="sm">{t("pages.homeSettings.product.sizeSmall")}</option>
            <option value="md">{t("pages.homeSettings.product.sizeMedium")}</option>
            <option value="lg">{t("pages.homeSettings.product.sizeLarge")}</option>
            <option value="xl">{t("pages.homeSettings.product.sizeXl")}</option>
            <option value="2xl">{t("pages.homeSettings.product.sizeHuge")}</option>
          </select>
        </div>

        <ColorInput
          id="shadow-color"
          label={t("pages.homeSettings.product.shadowColor")}
          value={cardStyle.shadowColor}
          onChange={(value) => onStyleChange("shadowColor", value)}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="hover-effect" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.product.hoverEffect")}
          </label>
          <select
            id="hover-effect"
            value={cardStyle.hoverEffect}
            onChange={(event) =>
              onStyleChange(
                "hoverEffect",
                event.target.value as ProductCardStyle["hoverEffect"]
              )
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">{t("common.none")}</option>
            <option value="lift">{t("pages.homeSettings.product.hoverLift")}</option>
            <option value="shadow">{t("pages.homeSettings.product.hoverShadow")}</option>
            <option value="scale">{t("pages.homeSettings.product.hoverScale")}</option>
            <option value="border">{t("pages.homeSettings.product.hoverBorder")}</option>
            <option value="glow">{t("pages.homeSettings.product.hoverGlow")}</option>
          </select>
        </div>

        {cardStyle.hoverEffect === "scale" ? (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.product.hoverScaleLabel")}: {(cardStyle.hoverScale ?? 1.02).toFixed(2)}×
            </label>
            <input
              type="range"
              min={1}
              max={1.1}
              step={0.01}
              value={cardStyle.hoverScale ?? 1.02}
              onChange={(event) => onStyleChange("hoverScale", Number(event.target.value))}
              className="w-full"
            />
          </div>
        ) : null}

        {cardStyle.hoverEffect === "shadow" ? (
          <div className="space-y-2">
            <label htmlFor="hover-shadow" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.product.hoverShadowSize")}
            </label>
            <select
              id="hover-shadow"
              value={cardStyle.hoverShadowSize ?? "lg"}
              onChange={(event) =>
                onStyleChange(
                  "hoverShadowSize",
                  event.target.value as ProductCardStyle["hoverShadowSize"]
                )
              }
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="sm">{t("pages.homeSettings.product.sizeSmall")}</option>
              <option value="md">{t("pages.homeSettings.product.sizeMedium")}</option>
              <option value="lg">{t("pages.homeSettings.product.sizeLarge")}</option>
              <option value="xl">{t("pages.homeSettings.product.sizeXl")}</option>
              <option value="2xl">{t("pages.homeSettings.product.sizeHuge")}</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ColorInput
          id="background-color"
          label={t("pages.homeSettings.branding.backgroundColor")}
          value={cardStyle.backgroundColor}
          onChange={(value) => onStyleChange("backgroundColor", value)}
        />
        <ColorInput
          id="hover-background-color"
          label={t("pages.homeSettings.product.hoverBg")}
          value={cardStyle.hoverBackgroundColor}
          onChange={(value) => onStyleChange("hoverBackgroundColor", value)}
          helper={t("pages.homeSettings.product.hoverBgHelper")}
          allowClear
          onClear={() => onStyleChange("hoverBackgroundColor", undefined)}
        />
      </div>

      <div>
        <Button
          type="button"
          variant="ghost"
          className="text-sm text-slate-500 hover:text-slate-900"
          onClick={() => {
            onStyleChange("borderWidth", DEFAULT_CARD_STYLE.borderWidth);
            onStyleChange("borderColor", DEFAULT_CARD_STYLE.borderColor);
            onStyleChange("borderStyle", DEFAULT_CARD_STYLE.borderStyle);
            onStyleChange("shadowSize", DEFAULT_CARD_STYLE.shadowSize);
            onStyleChange("shadowColor", DEFAULT_CARD_STYLE.shadowColor);
            onStyleChange("borderRadius", DEFAULT_CARD_STYLE.borderRadius);
            onStyleChange("hoverEffect", DEFAULT_CARD_STYLE.hoverEffect);
            onStyleChange("hoverScale", DEFAULT_CARD_STYLE.hoverScale);
            onStyleChange("hoverShadowSize", DEFAULT_CARD_STYLE.hoverShadowSize);
            onStyleChange("backgroundColor", DEFAULT_CARD_STYLE.backgroundColor);
            onStyleChange("hoverBackgroundColor", DEFAULT_CARD_STYLE.hoverBackgroundColor);
          }}
        >
          {t("pages.homeSettings.product.resetDefaults")}
        </Button>
      </div>
    </SectionCard>
  );
}

interface CDNFormProps {
  cdnCredentials: CDNCredentials;
  onChange: <K extends keyof CDNCredentials>(key: K, value: CDNCredentials[K]) => void;
  hasUnsavedChanges?: boolean;
}

function CDNForm({ cdnCredentials, onChange, hasUnsavedChanges }: CDNFormProps) {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/b2b/home-settings/test-cdn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cdn_url: cdnCredentials.cdn_url,
          bucket_region: cdnCredentials.bucket_region,
          bucket_name: cdnCredentials.bucket_name,
          folder_name: cdnCredentials.folder_name,
          cdn_key: cdnCredentials.cdn_key,
          cdn_secret: cdnCredentials.cdn_secret,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: data.message || "Connection successful!" });
      } else {
        setTestResult({
          success: false,
          message: data.error + (data.details ? `: ${data.details}` : ""),
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to test connection. Please check your network.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const canTest = cdnCredentials.cdn_url && cdnCredentials.bucket_region &&
                  cdnCredentials.bucket_name && cdnCredentials.cdn_key && cdnCredentials.cdn_secret;

  return (
    <SectionCard
      title={t("pages.homeSettings.cdn.title")}
      description={t("pages.homeSettings.cdn.description")}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="cdn-url" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.endpointUrl")}
          </label>
          <input
            id="cdn-url"
            type="text"
            value={cdnCredentials.cdn_url || ""}
            onChange={(e) => onChange("cdn_url", e.target.value)}
            placeholder="https://s3.eu-de.cloud-object-storage.appdomain.cloud"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.cdn.endpointUrlHelper")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="bucket-region" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.bucketRegion")}
          </label>
          <input
            id="bucket-region"
            type="text"
            value={cdnCredentials.bucket_region || ""}
            onChange={(e) => onChange("bucket_region", e.target.value)}
            placeholder="eu-de"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="bucket-name" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.bucketName")}
          </label>
          <input
            id="bucket-name"
            type="text"
            value={cdnCredentials.bucket_name || ""}
            onChange={(e) => onChange("bucket_name", e.target.value)}
            placeholder="my-bucket"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="folder-name" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.folderName")}
          </label>
          <input
            id="folder-name"
            type="text"
            value={cdnCredentials.folder_name || ""}
            onChange={(e) => onChange("folder_name", e.target.value)}
            placeholder="uploads"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.cdn.folderNameHelper")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-key" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.accessKeyId")}
          </label>
          <input
            id="cdn-key"
            type="password"
            value={cdnCredentials.cdn_key || ""}
            onChange={(e) => onChange("cdn_key", e.target.value)}
            placeholder="••••••••••••••••"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-secret" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.cdn.secretAccessKey")}
          </label>
          <input
            id="cdn-secret"
            type="password"
            value={cdnCredentials.cdn_secret || ""}
            onChange={(e) => onChange("cdn_secret", e.target.value)}
            placeholder="••••••••••••••••••••••••••••••••"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 pt-6 mt-6">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">{t("pages.homeSettings.cdn.advancedSettings")}</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="signed-url-expiry" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.cdn.signedUrlExpiry")}
            </label>
            <input
              id="signed-url-expiry"
              type="number"
              min={0}
              value={cdnCredentials.signed_url_expiry || 0}
              onChange={(e) => onChange("signed_url_expiry", Number(e.target.value))}
              placeholder="0"
              className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.cdn.signedUrlExpiryHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.cdn.deleteFromCloud")}
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onChange("delete_from_cloud", !cdnCredentials.delete_from_cloud)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  cdnCredentials.delete_from_cloud ? "bg-primary" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    cdnCredentials.delete_from_cloud ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-slate-600">
                {cdnCredentials.delete_from_cloud ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.cdn.deleteFromCloudHelper")}
            </p>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        {hasUnsavedChanges && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            {t("pages.homeSettings.cdn.saveBeforeTesting")}
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.cdn.testConnection")}</h3>
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.cdn.testConnectionHelper")}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={!canTest || isTesting}
            className="gap-2"
          >
            {isTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pages.homeSettings.cdn.testing")}
              </>
            ) : (
              t("pages.homeSettings.cdn.testConnection")
            )}
          </Button>
        </div>

        {testResult && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-4 py-3 text-sm",
              testResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            {testResult.message}
            {testResult.success && hasUnsavedChanges && (
              <span className="block mt-1 font-medium">
                {t("pages.homeSettings.cdn.saveToApply")}
              </span>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

interface EmailSettingsFormProps {
  emailTransport: EmailTransport;
  onTransportChange: (transport: EmailTransport) => void;
  smtpSettings: SMTPSettings;
  onSmtpChange: <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => void;
  graphSettings: GraphSettings;
  onGraphChange: <K extends keyof GraphSettings>(key: K, value: GraphSettings[K]) => void;
}

function EmailSettingsForm({
  emailTransport,
  onTransportChange,
  smtpSettings,
  onSmtpChange,
  graphSettings,
  onGraphChange,
}: EmailSettingsFormProps) {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestSmtp = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/b2b/home-settings/test-smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: smtpSettings.host,
          port: smtpSettings.port,
          secure: smtpSettings.secure,
          user: smtpSettings.user,
          password: smtpSettings.password,
          from: smtpSettings.from,
          from_name: smtpSettings.from_name,
          default_to: testEmail || smtpSettings.default_to,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: data.message || "Connection successful! Test email sent." });
      } else {
        setTestResult({
          success: false,
          message: data.error + (data.details ? `: ${data.details}` : ""),
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to test connection. Please check your network.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestGraph = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/b2b/home-settings/test-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: graphSettings.client_id,
          azure_tenant_id: graphSettings.azure_tenant_id,
          client_secret: graphSettings.client_secret,
          sender_email: graphSettings.sender_email,
          sender_name: graphSettings.sender_name,
          test_recipient: testEmail || graphSettings.sender_email,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResult({ success: true, message: data.message || "Graph API test successful!" });
      } else {
        setTestResult({
          success: false,
          message: data.error + (data.details ? `: ${data.details}` : ""),
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: "Failed to test Graph API. Please check your network.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // SMTP validation
  const isLocalhost = smtpSettings.host === "localhost" || smtpSettings.host === "127.0.0.1";
  const hasSmtpAuth = smtpSettings.user && smtpSettings.password;
  const canTestSmtp = smtpSettings.host && smtpSettings.port && smtpSettings.from &&
                      (hasSmtpAuth || isLocalhost);

  // Graph validation
  const canTestGraph = graphSettings.client_id && graphSettings.azure_tenant_id &&
                       graphSettings.client_secret && graphSettings.sender_email;

  const canTest = emailTransport === "smtp" ? canTestSmtp : canTestGraph;
  const handleTest = emailTransport === "smtp" ? handleTestSmtp : handleTestGraph;

  // Reset test result when switching transport
  const handleTransportSwitch = (transport: EmailTransport) => {
    setTestResult(null);
    onTransportChange(transport);
  };

  const inputClass = "w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

  return (
    <SectionCard
      title={t("pages.homeSettings.email.title")}
      description={t("pages.homeSettings.email.description")}
    >
      {/* Transport Selector */}
      <div className="mb-6">
        <label className="text-sm font-medium text-slate-600 mb-3 block">
          {t("pages.homeSettings.email.transport")}
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => handleTransportSwitch("smtp")}
            className={cn(
              "flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all",
              emailTransport === "smtp"
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.email.smtp")}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t("pages.homeSettings.email.smtpDesc")}</div>
          </button>
          <button
            type="button"
            onClick={() => handleTransportSwitch("graph")}
            className={cn(
              "flex-1 rounded-xl border-2 px-4 py-3 text-left transition-all",
              emailTransport === "graph"
                ? "border-primary bg-primary/5"
                : "border-slate-200 hover:border-slate-300"
            )}
          >
            <div className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.email.graph")}</div>
            <div className="text-xs text-slate-500 mt-0.5">{t("pages.homeSettings.email.graphDesc")}</div>
          </button>
        </div>
      </div>

      {/* SMTP Fields */}
      {emailTransport === "smtp" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="smtp-host" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.smtpHost")}
            </label>
            <input
              id="smtp-host"
              type="text"
              value={smtpSettings.host || ""}
              onChange={(e) => onSmtpChange("host", e.target.value)}
              placeholder="smtp.example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-port" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.port")}
            </label>
            <input
              id="smtp-port"
              type="number"
              value={smtpSettings.port || 587}
              onChange={(e) => onSmtpChange("port", Number(e.target.value))}
              placeholder="587"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.portHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-user" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.username")}
            </label>
            <input
              id="smtp-user"
              type="text"
              value={smtpSettings.user || ""}
              onChange={(e) => onSmtpChange("user", e.target.value)}
              placeholder="noreply@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-password" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.password")}
            </label>
            <input
              id="smtp-password"
              type="password"
              value={smtpSettings.password || ""}
              onChange={(e) => onSmtpChange("password", e.target.value)}
              placeholder="••••••••••••"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-from" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.fromEmail")}
            </label>
            <input
              id="smtp-from"
              type="email"
              value={smtpSettings.from || ""}
              onChange={(e) => onSmtpChange("from", e.target.value)}
              placeholder="noreply@example.com"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-from-name" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.fromName")}
            </label>
            <input
              id="smtp-from-name"
              type="text"
              value={smtpSettings.from_name || ""}
              onChange={(e) => onSmtpChange("from_name", e.target.value)}
              placeholder="My Company"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="smtp-default-to" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.defaultRecipient")}
            </label>
            <input
              id="smtp-default-to"
              type="email"
              value={smtpSettings.default_to || ""}
              onChange={(e) => onSmtpChange("default_to", e.target.value)}
              placeholder="info@example.com"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.defaultRecipientHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.secureTls")}
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onSmtpChange("secure", !smtpSettings.secure)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  smtpSettings.secure ? "bg-primary" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    smtpSettings.secure ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-slate-600">
                {smtpSettings.secure ? t("pages.homeSettings.email.secureEnabled") : t("pages.homeSettings.email.secureDisabled")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Graph API Fields */}
      {emailTransport === "graph" && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="graph-client-id" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.clientId")}
            </label>
            <input
              id="graph-client-id"
              type="text"
              value={graphSettings.client_id || ""}
              onChange={(e) => onGraphChange("client_id", e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.clientIdHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-tenant-id" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.azureTenantId")}
            </label>
            <input
              id="graph-tenant-id"
              type="text"
              value={graphSettings.azure_tenant_id || ""}
              onChange={(e) => onGraphChange("azure_tenant_id", e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.azureTenantIdHelper")}
            </p>
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="graph-secret" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.clientSecret")}
            </label>
            <input
              id="graph-secret"
              type="password"
              value={graphSettings.client_secret || ""}
              onChange={(e) => onGraphChange("client_secret", e.target.value)}
              placeholder="••••••••••••••••••••••••"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-sender" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.senderEmail")}
            </label>
            <input
              id="graph-sender"
              type="email"
              value={graphSettings.sender_email || ""}
              onChange={(e) => onGraphChange("sender_email", e.target.value)}
              placeholder="noreply@company.com"
              className={inputClass}
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.senderEmailHelper")}
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="graph-sender-name" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.senderName")}
            </label>
            <input
              id="graph-sender-name"
              type="text"
              value={graphSettings.sender_name || ""}
              onChange={(e) => onGraphChange("sender_name", e.target.value)}
              placeholder="My Company"
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.email.saveToSent")}
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => onGraphChange("save_to_sent_items", !graphSettings.save_to_sent_items)}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  graphSettings.save_to_sent_items ? "bg-primary" : "bg-slate-200"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    graphSettings.save_to_sent_items ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </button>
              <span className="text-sm text-slate-600">
                {graphSettings.save_to_sent_items ? t("common.enabled") : t("common.disabled")}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.saveToSentHelper")}
            </p>
          </div>
        </div>
      )}

      {/* Test Connection */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.email.testConnection")}</h3>
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.email.testConnectionHelper", { transport: emailTransport === "smtp" ? "SMTP" : "Graph API" })}
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <label htmlFor="test-email" className="text-sm font-medium text-slate-600">
                {t("pages.homeSettings.email.sendTestTo")}
              </label>
              <input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={
                  emailTransport === "smtp"
                    ? (smtpSettings.default_to || smtpSettings.from || "test@example.com")
                    : (graphSettings.sender_email || "test@example.com")
                }
                className={inputClass}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTest}
              disabled={!canTest || isTesting}
              className="gap-2 h-[38px]"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("pages.homeSettings.email.sending")}
                </>
              ) : (
                t("pages.homeSettings.email.sendTestEmail")
              )}
            </Button>
          </div>
        </div>

        {testResult && (
          <div
            className={cn(
              "mt-4 rounded-lg border px-4 py-3 text-sm",
              testResult.success
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            )}
          >
            {testResult.message}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Company Info Form
// ============================================================================

interface CompanyInfoFormProps {
  companyInfo: CompanyContactInfo;
  onChange: <K extends keyof CompanyContactInfo>(key: K, value: CompanyContactInfo[K]) => void;
}

function CompanyInfoForm({ companyInfo, onChange }: CompanyInfoFormProps) {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("pages.homeSettings.company.title")}
      description={t("pages.homeSettings.company.description")}
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="company-legal-name" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.legalName")}
          </label>
          <input
            id="company-legal-name"
            type="text"
            value={companyInfo.legal_name || ""}
            onChange={(e) => onChange("legal_name", e.target.value)}
            placeholder="My Company Srl"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.company.legalNameHelper")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-vat" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.vatNumber")}
          </label>
          <input
            id="company-vat"
            type="text"
            value={companyInfo.vat_number || ""}
            onChange={(e) => onChange("vat_number", e.target.value)}
            placeholder="IT12345678901"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-address1" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.addressLine1")}
          </label>
          <input
            id="company-address1"
            type="text"
            value={companyInfo.address_line1 || ""}
            onChange={(e) => onChange("address_line1", e.target.value)}
            placeholder="Via Roma, 123"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-address2" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.addressLine2")}
          </label>
          <input
            id="company-address2"
            type="text"
            value={companyInfo.address_line2 || ""}
            onChange={(e) => onChange("address_line2", e.target.value)}
            placeholder="00100 Roma (RM)"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.company.addressLine2Helper")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-phone" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.phone")}
          </label>
          <input
            id="company-phone"
            type="tel"
            value={companyInfo.phone || ""}
            onChange={(e) => onChange("phone", e.target.value)}
            placeholder="+39 06 1234567"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-email" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.generalEmail")}
          </label>
          <input
            id="company-email"
            type="email"
            value={companyInfo.email || ""}
            onChange={(e) => onChange("email", e.target.value)}
            placeholder="info@company.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-support-email" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.supportEmail")}
          </label>
          <input
            id="company-support-email"
            type="email"
            value={companyInfo.support_email || ""}
            onChange={(e) => onChange("support_email", e.target.value)}
            placeholder="support@company.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            {t("pages.homeSettings.company.supportEmailHelper")}
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-hours" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.company.businessHours")}
          </label>
          <input
            id="company-hours"
            type="text"
            value={companyInfo.business_hours || ""}
            onChange={(e) => onChange("business_hours", e.target.value)}
            placeholder="Lun-Ven 9:00-18:00"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <h4 className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.company.footerPreview")}</h4>
        <p className="text-xs text-slate-500 mb-3">{t("pages.homeSettings.company.footerPreviewHelper")}</p>
        <div className="bg-white rounded border border-slate-200 p-4 text-center">
          <p className="font-semibold text-slate-900 text-sm">{companyInfo.legal_name || "Company Name"}</p>
          {(companyInfo.address_line1 || companyInfo.address_line2) && (
            <p className="text-xs text-slate-600 mt-1">
              {[companyInfo.address_line1, companyInfo.address_line2].filter(Boolean).join(" - ")}
            </p>
          )}
          {(companyInfo.phone || companyInfo.email) && (
            <p className="text-xs text-slate-600 mt-1">
              {[
                companyInfo.phone ? `📞 ${companyInfo.phone}` : "",
                companyInfo.email ? `✉️ ${companyInfo.email}` : ""
              ].filter(Boolean).join(" | ")}
            </p>
          )}
          {companyInfo.business_hours && (
            <p className="text-xs text-slate-600 mt-1">🕐 {companyInfo.business_hours}</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

// API Key types
interface APIKeyData {
  _id: string;
  key_id: string;
  name: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  created_at: string;
  created_by: string;
}

interface APIKeyPermission {
  value: string;
  label: string;
  description: string;
}

function APIKeysForm() {
  const { t } = useTranslation();
  const [keys, setKeys] = useState<APIKeyData[]>([]);
  const [permissions, setPermissions] = useState<APIKeyPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create key modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyPermissions, setNewKeyPermissions] = useState<string[]>(["*"]);
  const [isCreating, setIsCreating] = useState(false);

  // Created key display state (shown after creation)
  const [createdKey, setCreatedKey] = useState<{ key_id: string; secret: string } | null>(null);
  const [copiedField, setCopiedField] = useState<"key" | "secret" | null>(null);

  // Delete confirmation state
  const [keyToDelete, setKeyToDelete] = useState<APIKeyData | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/b2b/api-keys");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load API keys");
      }

      setKeys(data.keys || []);
      setPermissions(data.permissions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKeys();
  }, [loadKeys]);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const response = await fetch("/api/b2b/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          permissions: newKeyPermissions,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create API key");
      }

      // Show the created key with secret
      setCreatedKey({
        key_id: data.key.key_id,
        secret: data.secret,
      });

      // Reset form and close modal
      setShowCreateModal(false);
      setNewKeyName("");
      setNewKeyPermissions(["*"]);

      // Reload keys list
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggleActive = async (key: APIKeyData) => {
    try {
      const response = await fetch(`/api/b2b/api-keys/${key._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !key.is_active }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update API key");
      }

      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update API key");
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/b2b/api-keys/${keyToDelete._id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete API key");
      }

      setKeyToDelete(null);
      loadKeys();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete API key");
    } finally {
      setIsDeleting(false);
    }
  };

  const copyToClipboard = async (text: string, field: "key" | "secret") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t("pages.homeSettings.apiKeys.never");
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <SectionCard
      title={t("pages.homeSettings.apiKeys.title")}
      description={t("pages.homeSettings.apiKeys.description")}
    >
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* Created Key Display */}
      {createdKey && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-3">
              <div>
                <h4 className="font-semibold text-amber-800">{t("pages.homeSettings.apiKeys.saveCredentials")}</h4>
                <p className="text-sm text-amber-700">
                  {t("pages.homeSettings.apiKeys.secretWarning")}
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-amber-700">{t("pages.homeSettings.apiKeys.apiKey")}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono border border-amber-200">
                      {createdKey.key_id}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdKey.key_id, "key")}
                      className="shrink-0"
                    >
                      {copiedField === "key" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-amber-700">{t("pages.homeSettings.apiKeys.apiSecret")}</label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono border border-amber-200">
                      {createdKey.secret}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(createdKey.secret, "secret")}
                      className="shrink-0"
                    >
                      {copiedField === "secret" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCreatedKey(null)}
                className="text-amber-700 border-amber-300 hover:bg-amber-100"
              >
                {t("pages.homeSettings.apiKeys.savedCredentials")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{t("pages.homeSettings.apiKeys.yourKeys")}</h3>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            {t("pages.homeSettings.apiKeys.createNewKey")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
            <Key className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">{t("pages.homeSettings.apiKeys.noKeysYet")}</p>
            <p className="text-xs text-slate-500">{t("pages.homeSettings.apiKeys.noKeysYetDesc")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {keys.map((key) => (
              <div
                key={key._id}
                className={cn(
                  "rounded-lg border p-4",
                  key.is_active
                    ? "border-slate-200 bg-white"
                    : "border-slate-200 bg-slate-50 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{key.name}</h4>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          key.is_active
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-200 text-slate-600"
                        )}
                      >
                        {key.is_active ? t("common.active") : t("common.inactive")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500 truncate">
                      {key.key_id}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>{t("pages.homeSettings.apiKeys.created")}: {formatDate(key.created_at)}</span>
                      <span>{t("pages.homeSettings.apiKeys.lastUsed")}: {formatDate(key.last_used_at)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {key.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {perm === "*" ? t("pages.homeSettings.apiKeys.fullAccess") : perm}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(key)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        key.is_active ? "bg-emerald-500" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                          key.is_active ? "translate-x-6" : "translate-x-1"
                        )}
                      />
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setKeyToDelete(key)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">{t("pages.homeSettings.apiKeys.createNewKey")}</h3>
            <p className="mt-1 text-sm text-slate-500">
              {t("pages.homeSettings.apiKeys.createNewKeyDesc")}
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="key-name" className="text-sm font-medium text-slate-600">
                  {t("pages.homeSettings.apiKeys.keyName")}
                </label>
                <input
                  id="key-name"
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., ERP Integration"
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-600">{t("pages.homeSettings.apiKeys.permissions")}</label>
                <div className="space-y-2">
                  {permissions.map((perm) => (
                    <label key={perm.value} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newKeyPermissions.includes(perm.value)}
                        onChange={(e) => {
                          if (perm.value === "*") {
                            setNewKeyPermissions(e.target.checked ? ["*"] : []);
                          } else {
                            if (e.target.checked) {
                              setNewKeyPermissions((prev) =>
                                prev.filter((p) => p !== "*").concat(perm.value)
                              );
                            } else {
                              setNewKeyPermissions((prev) =>
                                prev.filter((p) => p !== perm.value)
                              );
                            }
                          }
                        }}
                        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-700">{perm.label}</p>
                        <p className="text-xs text-slate-500">{perm.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  setNewKeyName("");
                  setNewKeyPermissions(["*"]);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleCreateKey}
                disabled={!newKeyName.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pages.homeSettings.apiKeys.creating")}
                  </>
                ) : (
                  t("pages.homeSettings.apiKeys.createKey")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {keyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{t("pages.homeSettings.apiKeys.deleteKey")}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {t("pages.homeSettings.apiKeys.deleteKeyConfirm", { name: keyToDelete.name })}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setKeyToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteKey}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("pages.homeSettings.apiKeys.deleting")}
                  </>
                ) : (
                  t("pages.homeSettings.apiKeys.deleteKey")
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

interface FooterFormProps {
  footerHtml: string;
  footerHtmlDraft: string;
  branding: CompanyBranding;
  onDraftChange: (html: string) => void;
  onPublish: () => Promise<void>;
}

interface FooterImage {
  url: string;
  name: string;
  uploadedAt: Date;
}

function FooterForm({ footerHtml, footerHtmlDraft, branding, onDraftChange, onPublish }: FooterFormProps) {
  const { t } = useTranslation();
  const [isPublishing, setIsPublishing] = useState(false);
  const [footerImages, setFooterImages] = useState<FooterImage[]>([]);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadState, uploadImage, resetError } = useImageUpload();

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadImage(file);
    if (url) {
      setFooterImages(prev => [
        { url, name: file.name, uploadedAt: new Date() },
        ...prev
      ]);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleCopyUrl = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleInsertImage = (url: string, name: string) => {
    const imgTag = `<img src="${url}" alt="${name}" class="h-auto max-w-full" />`;
    onDraftChange(footerHtmlDraft + "\n" + imgTag);
  };

  const handleRemoveImage = (url: string) => {
    setFooterImages(prev => prev.filter(img => img.url !== url));
  };

  const hasUnsavedChanges = footerHtmlDraft !== footerHtml;
  const year = new Date().getFullYear();

  // Sanitize HTML for preview
  const sanitizedHtml = useMemo(() => {
    if (typeof window === "undefined") return "";
    return DOMPurify.sanitize(footerHtmlDraft);
  }, [footerHtmlDraft]);

  const exampleHtml = `<div class="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
  <div class="flex items-center gap-4">
    <img src="/assets/vinc/logo.png" class="h-[80px] w-auto" alt="Logo" />
    <div class="text-[40px] text-[#7a7a7a]">
      <div class="font-bold">Hidros</div>
      <div class="font-normal">Point</div>
    </div>
  </div>

  <div class="flex flex-col gap-3 text-sm">
    <div>📍 Via Example 123, Milan</div>
    <div>📞 +39 0123 456789</div>
    <div>✉️ info@company.com</div>
  </div>
</div>`;

  return (
    <div className="space-y-4">
      {/* Status and Actions Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {t("pages.homeSettings.footer.draftUnpublished")}
            </span>
          ) : footerHtml ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {t("common.published")}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {t("pages.homeSettings.footer.noFooter")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {footerHtml && hasUnsavedChanges && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDraftChange(footerHtml)}
              className="text-xs text-slate-500"
            >
              {t("pages.homeSettings.footer.revertToPublished")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing || !footerHtmlDraft}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pages.homeSettings.footer.publishing")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {t("common.publish")}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Accordion Sections */}
      <AccordionGroup>
        {/* HTML Editor Accordion */}
        <AccordionItem
          title={t("pages.homeSettings.footer.htmlEditor")}
          description={t("pages.homeSettings.footer.htmlEditorDesc")}
          defaultOpen={true}
          badge={
            footerHtmlDraft ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                {footerHtmlDraft.length} chars
              </span>
            ) : null
          }
        >
          <div className="space-y-4">
            <textarea
              id="footer-html"
              value={footerHtmlDraft}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder={exampleHtml}
              rows={12}
              className="w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-slate-500">
              {t("pages.homeSettings.footer.htmlEditorHelper")}
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDraftChange(exampleHtml)}
                className="text-xs"
              >
                {t("pages.homeSettings.footer.loadExample")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDraftChange("")}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                Clear
              </Button>
            </div>
          </div>
        </AccordionItem>

        {/* Footer Images Accordion */}
        <AccordionItem
          title={t("pages.homeSettings.footer.footerImages")}
          description={t("pages.homeSettings.footer.footerImagesDesc")}
          defaultOpen={false}
          badge={
            footerImages.length > 0 ? (
              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                {footerImages.length} image{footerImages.length > 1 ? "s" : ""}
              </span>
            ) : null
          }
          actions={
            <div onClick={(e) => e.stopPropagation()}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleImageUpload}
                className="hidden"
                id="footer-image-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadState.isUploading}
                className="gap-2"
              >
                {uploadState.isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("pages.homeSettings.branding.uploading")}
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          }
        >
          <div className="space-y-3">
            {uploadState.error && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700 flex items-center justify-between">
                <span>{uploadState.error}</span>
                <button
                  type="button"
                  onClick={resetError}
                  className="text-rose-500 hover:text-rose-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            )}

            {footerImages.length > 0 ? (
              <div className="space-y-2">
                {footerImages.map((image) => (
                  <div
                    key={image.url}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt={image.name}
                      className="h-12 w-12 rounded object-cover border border-slate-200"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-slate-700 truncate">{image.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{image.url}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopyUrl(image.url)}
                        className="h-8 w-8 p-0"
                        title="Copy URL"
                      >
                        {copiedUrl === image.url ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4 text-slate-500" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleInsertImage(image.url, image.name)}
                        className="h-8 px-2 text-xs text-primary"
                        title="Insert into HTML"
                      >
                        Insert
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveImage(image.url)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                        title="Remove from list"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-6 text-center">
                <Upload className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                <p className="text-sm text-slate-500">{t("pages.homeSettings.footer.noImages")}</p>
                <p className="text-xs text-slate-400">{t("pages.homeSettings.footer.noImagesDesc")}</p>
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Live Preview Accordion */}
        <AccordionItem
          title={t("pages.homeSettings.footer.livePreview")}
          description={t("pages.homeSettings.footer.livePreviewDesc")}
          defaultOpen={true}
          badge={
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Preview
            </span>
          }
        >
          <div className="bg-slate-100 -mx-4 -mb-4 p-4 rounded-b-xl">
            <footer className="rounded-lg overflow-hidden shadow-lg">
              <div
                className="border-t-[6px]"
                style={{
                  borderColor: branding.primaryColor || "#009f7f",
                  backgroundColor: branding.footerBackgroundColor || "#f5f5f5",
                  color: branding.footerTextColor || "#666666",
                }}
              >
                {sanitizedHtml && (
                  <div
                    className="mx-auto max-w-[1920px] px-4 md:px-6 lg:px-8 2xl:px-10 py-8 lg:py-10"
                    dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
                  />
                )}

                {!sanitizedHtml && (
                  <div className="mx-auto max-w-[1920px] px-4 py-8 text-center text-sm text-slate-400">
                    {t("pages.homeSettings.footer.enterHtmlPreview")}
                  </div>
                )}

                {/* Copyright bar */}
                <div
                  className="py-3 text-center text-xs font-semibold text-white md:text-sm"
                  style={{ backgroundColor: branding.primaryColor || "#009f7f" }}
                >
                  Copyright © {year} {branding.title || "Your Company"} All rights reserved.
                </div>
              </div>
            </footer>
          </div>
        </AccordionItem>
      </AccordionGroup>
    </div>
  );
}

// ============================================================================
// Header Builder Components
// ============================================================================

interface HeaderFormProps {
  headerConfig: HeaderConfig;
  headerConfigDraft: HeaderConfig;
  branding: CompanyBranding;
  onDraftChange: (config: HeaderConfig) => void;
  onPublish: () => Promise<void>;
}

const LAYOUT_OPTIONS: { value: RowLayout; label: string; description: string }[] = [
  { value: "full", label: "Full Width", description: "1 block (100%)" },
  { value: "50-50", label: "50-50", description: "2 blocks (50% / 50%)" },
  { value: "20-60-20", label: "20-60-20", description: "Logo | Search | Icons" },
  { value: "25-50-25", label: "25-50-25", description: "Balanced header" },
  { value: "30-40-30", label: "30-40-30", description: "Compact center" },
  { value: "33-33-33", label: "33-33-33", description: "3 equal blocks" },
];

const WIDGET_ICONS: Record<HeaderWidgetType, typeof Image> = {
  "logo": Image,
  "search-bar": Search,
  "radio-widget": Radio,
  "category-menu": Menu,
  "cart": ShoppingCart,
  "company-info": Building2,
  "no-price": EyeOff,
  "favorites": Heart,
  "compare": GitCompare,
  "profile": User,
  "notifications": Bell,
  "reminders": History,
  "app-launcher": LayoutGrid,
  "button": Square,
  "spacer": Space,
  "divider": Minus,
};

// ============================================================================
// Meta Tags Form Component
// ============================================================================

function MetaTagsForm({ metaTags, onChange }: MetaTagsFormProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* Basic SEO */}
      <SectionCard title={t("pages.homeSettings.seo.basicTitle")} description={t("pages.homeSettings.seo.basicDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="meta-title" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.pageTitle")}
            </label>
            <input
              id="meta-title"
              type="text"
              value={metaTags.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="Your Company - B2B Store"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.pageTitleHelper")}</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="meta-description" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.metaDescription")}
            </label>
            <textarea
              id="meta-description"
              value={metaTags.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="A brief description of your B2B store for search results..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.metaDescriptionHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-keywords" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.keywords")}
            </label>
            <input
              id="meta-keywords"
              type="text"
              value={metaTags.keywords || ""}
              onChange={(e) => onChange("keywords", e.target.value)}
              placeholder="b2b, wholesale, products"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.keywordsHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-author" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.author")}
            </label>
            <input
              id="meta-author"
              type="text"
              value={metaTags.author || ""}
              onChange={(e) => onChange("author", e.target.value)}
              placeholder="Company Name"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-robots" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.robotsDirective")}
            </label>
            <select
              id="meta-robots"
              value={metaTags.robots || "index, follow"}
              onChange={(e) => onChange("robots", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="index, follow">{t("pages.homeSettings.seo.robotsIndexFollow")}</option>
              <option value="noindex, follow">{t("pages.homeSettings.seo.robotsNoIndexFollow")}</option>
              <option value="index, nofollow">{t("pages.homeSettings.seo.robotsIndexNoFollow")}</option>
              <option value="noindex, nofollow">{t("pages.homeSettings.seo.robotsNoIndexNoFollow")}</option>
            </select>
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.robotsHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-canonical" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.canonicalUrl")}
            </label>
            <input
              id="meta-canonical"
              type="url"
              value={metaTags.canonicalUrl || ""}
              onChange={(e) => onChange("canonicalUrl", e.target.value)}
              placeholder="https://shop.example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.canonicalUrlHelper")}</p>
          </div>
        </div>
      </SectionCard>

      {/* Open Graph */}
      <SectionCard title={t("pages.homeSettings.seo.ogTitle")} description={t("pages.homeSettings.seo.ogDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="og-title" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.ogTitleField")}
            </label>
            <input
              id="og-title"
              type="text"
              value={metaTags.ogTitle || ""}
              onChange={(e) => onChange("ogTitle", e.target.value)}
              placeholder="Leave empty to use page title"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="og-sitename" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.siteName")}
            </label>
            <input
              id="og-sitename"
              type="text"
              value={metaTags.ogSiteName || ""}
              onChange={(e) => onChange("ogSiteName", e.target.value)}
              placeholder="Your Company"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="og-description" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.ogDescField")}
            </label>
            <textarea
              id="og-description"
              value={metaTags.ogDescription || ""}
              onChange={(e) => onChange("ogDescription", e.target.value)}
              placeholder="Leave empty to use meta description"
              rows={2}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="og-image" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.ogImageUrl")}
            </label>
            <input
              id="og-image"
              type="url"
              value={metaTags.ogImage || ""}
              onChange={(e) => onChange("ogImage", e.target.value)}
              placeholder="https://cdn.example.com/og-image.jpg"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.ogImageHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="og-type" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.ogType")}
            </label>
            <select
              id="og-type"
              value={metaTags.ogType || "website"}
              onChange={(e) => onChange("ogType", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="website">Website</option>
              <option value="article">Article</option>
              <option value="product">Product</option>
              <option value="business.business">Business</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* Twitter Card */}
      <SectionCard title={t("pages.homeSettings.seo.twitterTitle")} description={t("pages.homeSettings.seo.twitterDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="twitter-card" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.cardType")}
            </label>
            <select
              id="twitter-card"
              value={metaTags.twitterCard || "summary_large_image"}
              onChange={(e) => onChange("twitterCard", e.target.value as MetaTags["twitterCard"])}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
              <option value="app">App</option>
              <option value="player">Player</option>
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="twitter-site" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.siteUsername")}
            </label>
            <input
              id="twitter-site"
              type="text"
              value={metaTags.twitterSite || ""}
              onChange={(e) => onChange("twitterSite", e.target.value)}
              placeholder="@yourcompany"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="twitter-creator" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.creatorUsername")}
            </label>
            <input
              id="twitter-creator"
              type="text"
              value={metaTags.twitterCreator || ""}
              onChange={(e) => onChange("twitterCreator", e.target.value)}
              placeholder="@creator"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="twitter-image" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.twitterImageUrl")}
            </label>
            <input
              id="twitter-image"
              type="url"
              value={metaTags.twitterImage || ""}
              onChange={(e) => onChange("twitterImage", e.target.value)}
              placeholder="Leave empty to use OG image"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </SectionCard>

      {/* Additional Settings */}
      <SectionCard title={t("pages.homeSettings.seo.additionalTitle")} description={t("pages.homeSettings.seo.additionalDescription")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="theme-color" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.themeColor")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={metaTags.themeColor || "#009f7f"}
                onChange={(e) => onChange("themeColor", e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-slate-300"
              />
              <input
                id="theme-color"
                type="text"
                value={metaTags.themeColor || ""}
                onChange={(e) => onChange("themeColor", e.target.value)}
                placeholder="#009f7f"
                className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.themeColorHelper")}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="google-verification" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.googleVerification")}
            </label>
            <input
              id="google-verification"
              type="text"
              value={metaTags.googleSiteVerification || ""}
              onChange={(e) => onChange("googleSiteVerification", e.target.value)}
              placeholder="Verification code from Google Search Console"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="bing-verification" className="text-sm font-medium text-slate-600">
              {t("pages.homeSettings.seo.bingVerification")}
            </label>
            <input
              id="bing-verification"
              type="text"
              value={metaTags.bingSiteVerification || ""}
              onChange={(e) => onChange("bingSiteVerification", e.target.value)}
              placeholder="Verification code from Bing Webmaster Tools"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </SectionCard>

      {/* Structured Data */}
      <SectionCard title={t("pages.homeSettings.seo.structuredDataTitle")} description={t("pages.homeSettings.seo.structuredDataDescription")}>
        <div className="space-y-2">
          <label htmlFor="structured-data" className="text-sm font-medium text-slate-600">
            {t("pages.homeSettings.seo.jsonLdLabel")}
          </label>
          <textarea
            id="structured-data"
            value={metaTags.structuredData || ""}
            onChange={(e) => onChange("structuredData", e.target.value)}
            placeholder={`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://shop.example.com"
}`}
            rows={10}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-slate-500">{t("pages.homeSettings.seo.jsonLdHelper")}</p>
        </div>
      </SectionCard>
    </div>
  );
}

function HeaderForm({ headerConfig, headerConfigDraft, branding, onDraftChange, onPublish }: HeaderFormProps) {
  const { t } = useTranslation();
  const [selectedWidget, setSelectedWidget] = useState<{ rowId: string; blockId: string; widgetId: string } | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  // Compare configs to determine if there are unpublished changes
  const hasUnpublishedChanges = JSON.stringify(headerConfigDraft) !== JSON.stringify(headerConfig);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await onPublish();
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRevertToPublished = () => {
    onDraftChange(headerConfig);
  };

  const updateRow = (rowId: string, updates: Partial<HeaderRow>) => {
    onDraftChange({
      ...headerConfigDraft,
      rows: headerConfigDraft.rows.map((row) =>
        row.id === rowId ? { ...row, ...updates } : row
      ),
    });
  };

  const updateBlock = (rowId: string, blockId: string, updates: Partial<HeaderBlock>) => {
    onDraftChange({
      ...headerConfigDraft,
      rows: headerConfigDraft.rows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              blocks: row.blocks.map((block) =>
                block.id === blockId ? { ...block, ...updates } : block
              ),
            }
          : row
      ),
    });
  };

  const addRow = () => {
    const newRowId = `row-${Date.now()}`;
    const newRow: HeaderRow = {
      id: newRowId,
      enabled: true,
      fixed: false,
      backgroundColor: "#ffffff",
      layout: "50-50",
      blocks: [
        { id: `${newRowId}-left`, alignment: "left", widgets: [] },
        { id: `${newRowId}-right`, alignment: "right", widgets: [] },
      ],
    };
    onDraftChange({
      ...headerConfigDraft,
      rows: [...headerConfigDraft.rows, newRow],
    });
  };

  const deleteRow = (rowId: string) => {
    onDraftChange({
      ...headerConfigDraft,
      rows: headerConfigDraft.rows.filter((row) => row.id !== rowId),
    });
  };

  const moveRow = (rowId: string, direction: "up" | "down") => {
    const index = headerConfigDraft.rows.findIndex((r) => r.id === rowId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === headerConfigDraft.rows.length - 1) return;

    const newRows = [...headerConfigDraft.rows];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    onDraftChange({ ...headerConfigDraft, rows: newRows });
  };

  const changeLayout = (rowId: string, newLayout: RowLayout) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;

    const blockCount = LAYOUT_BLOCK_COUNT[newLayout];
    const currentBlockCount = row.blocks.length;

    let newBlocks = [...row.blocks];

    if (blockCount > currentBlockCount) {
      // Add new blocks
      const blockNames = ["left", "center", "right"];
      for (let i = currentBlockCount; i < blockCount; i++) {
        newBlocks.push({
          id: `${rowId}-${blockNames[i] || `block-${i}`}`,
          alignment: i === 0 ? "left" : i === blockCount - 1 ? "right" : "center",
          widgets: [],
        });
      }
    } else if (blockCount < currentBlockCount) {
      // Remove extra blocks (keep widgets from removed blocks in last remaining block)
      const removedBlocks = newBlocks.slice(blockCount);
      const removedWidgets = removedBlocks.flatMap((b) => b.widgets);
      newBlocks = newBlocks.slice(0, blockCount);
      if (newBlocks.length > 0) {
        newBlocks[newBlocks.length - 1].widgets.push(...removedWidgets);
      }
    }

    updateRow(rowId, { layout: newLayout, blocks: newBlocks });
  };

  const addWidgetToBlock = (rowId: string, blockId: string, widgetType: HeaderWidgetType) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;

    const block = row.blocks.find((b) => b.id === blockId);
    if (!block) return;

    // Check if widget already exists (for non-multiple types)
    const widgetMeta = HEADER_WIDGET_LIBRARY[widgetType];
    if (!widgetMeta.allowMultiple) {
      const allWidgets = headerConfigDraft.rows.flatMap((r) =>
        r.blocks.flatMap((b) => b.widgets)
      );
      if (allWidgets.some((w) => w.type === widgetType)) {
        return; // Widget already exists
      }
    }

    const newWidget: HeaderWidget = {
      id: `${widgetType}-${Date.now()}`,
      type: widgetType,
      config: {},
    };

    updateBlock(rowId, blockId, {
      widgets: [...block.widgets, newWidget],
    });
  };

  const removeWidget = (rowId: string, blockId: string, widgetId: string) => {
    const row = headerConfigDraft.rows.find((r) => r.id === rowId);
    if (!row) return;

    const block = row.blocks.find((b) => b.id === blockId);
    if (!block) return;

    updateBlock(rowId, blockId, {
      widgets: block.widgets.filter((w) => w.id !== widgetId),
    });

    if (selectedWidget?.widgetId === widgetId) {
      setSelectedWidget(null);
    }
  };

  const getUsedWidgetTypes = (): Set<HeaderWidgetType> => {
    const used = new Set<HeaderWidgetType>();
    headerConfigDraft.rows.forEach((row) => {
      row.blocks.forEach((block) => {
        block.widgets.forEach((widget) => {
          const meta = HEADER_WIDGET_LIBRARY[widget.type];
          if (!meta.allowMultiple) {
            used.add(widget.type);
          }
        });
      });
    });
    return used;
  };

  const usedWidgetTypes = getUsedWidgetTypes();

  return (
    <div className="space-y-4">
      {/* Status and Actions Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
              {t("pages.homeSettings.header.draftUnpublished")}
            </span>
          ) : headerConfig.rows.length > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              {t("common.published")}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {t("pages.homeSettings.header.noHeader")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges && headerConfig.rows.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRevertToPublished}
              className="text-xs text-slate-500"
            >
              {t("pages.homeSettings.header.revertToPublished")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={isPublishing || headerConfigDraft.rows.length === 0}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("pages.homeSettings.header.publishing")}
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Publish
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Two-column layout: Builder on left, Widget Config on right */}
      <div className="flex gap-4">
        {/* Left Column - Row Configuration */}
        <div className={cn("flex-1 min-w-0", selectedWidget && "max-w-[calc(100%-320px)]")}>
          <AccordionGroup>
            {/* Row Configuration Accordion */}
            <AccordionItem
              title={t("pages.homeSettings.header.rowConfig")}
              description={t("pages.homeSettings.header.rowConfigDesc")}
              defaultOpen={true}
              badge={
                headerConfigDraft.rows.length > 0 ? (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                    {headerConfigDraft.rows.filter(r => r.enabled).length}/{headerConfigDraft.rows.length} rows
                  </span>
                ) : null
              }
            >
              <div className="space-y-4">
          {headerConfigDraft.rows.map((row, rowIndex) => (
            <div
              key={row.id}
              className={cn(
                "rounded-xl border-2 transition-colors",
                row.enabled ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50"
              )}
            >
              {/* Row Header */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <GripVertical className="h-4 w-4 text-slate-400 cursor-grab" />

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(row.id, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    Row {rowIndex + 1}
                  </span>
                </label>

                <div className="flex-1" />

                {/* Layout Selector */}
                <select
                  value={row.layout}
                  onChange={(e) => changeLayout(row.id, e.target.value as RowLayout)}
                  disabled={!row.enabled}
                  className="rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Fixed Toggle */}
                <button
                  type="button"
                  onClick={() => updateRow(row.id, { fixed: !row.fixed })}
                  disabled={!row.enabled}
                  className={cn(
                    "flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors",
                    row.fixed
                      ? "bg-primary/10 text-primary"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                  )}
                  title={row.fixed ? "Fixed/Sticky" : "Scrollable"}
                >
                  {row.fixed ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
                  {row.fixed ? t("pages.homeSettings.header.fixed") : t("pages.homeSettings.header.scroll")}
                </button>

                {/* Row Actions */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, "up")}
                    disabled={rowIndex === 0}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveRow(row.id, "down")}
                    disabled={rowIndex === headerConfigDraft.rows.length - 1}
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRow(row.id)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-100 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Row Blocks */}
              {row.enabled && (
                <div className="p-4">
                  <div className="flex gap-2">
                    {row.blocks.map((block, blockIndex) => {
                      const widthPct = LAYOUT_WIDTHS[row.layout][blockIndex] || 100;
                      return (
                        <div
                          key={block.id}
                          className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
                          style={{ width: `${widthPct}%` }}
                        >
                          {/* Block Header */}
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-500">
                              {widthPct}%
                            </span>
                            <div className="flex gap-1">
                              {(["left", "center", "right"] as BlockAlignment[]).map((align) => (
                                <button
                                  key={align}
                                  type="button"
                                  onClick={() => updateBlock(row.id, block.id, { alignment: align })}
                                  className={cn(
                                    "rounded p-1 transition-colors",
                                    block.alignment === align
                                      ? "bg-primary/20 text-primary"
                                      : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                                  )}
                                  title={`Align ${align}`}
                                >
                                  {align === "left" && <AlignLeft className="h-3 w-3" />}
                                  {align === "center" && <AlignCenter className="h-3 w-3" />}
                                  {align === "right" && <AlignRight className="h-3 w-3" />}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Widgets in Block */}
                          <div
                            className={cn(
                              "flex flex-wrap gap-1 min-h-[40px]",
                              block.alignment === "left" && "justify-start",
                              block.alignment === "center" && "justify-center",
                              block.alignment === "right" && "justify-end"
                            )}
                          >
                            {block.widgets.map((widget) => {
                              const WidgetIcon = WIDGET_ICONS[widget.type];
                              const meta = HEADER_WIDGET_LIBRARY[widget.type];
                              const isSelected =
                                selectedWidget?.rowId === row.id &&
                                selectedWidget?.blockId === block.id &&
                                selectedWidget?.widgetId === widget.id;

                              return (
                                <div
                                  key={widget.id}
                                  onClick={() =>
                                    setSelectedWidget({
                                      rowId: row.id,
                                      blockId: block.id,
                                      widgetId: widget.id,
                                    })
                                  }
                                  className={cn(
                                    "flex items-center gap-1 rounded-md border px-2 py-1 text-xs cursor-pointer transition-colors",
                                    isSelected
                                      ? "border-primary bg-primary/10 text-primary"
                                      : "border-slate-200 bg-white text-slate-600 hover:border-primary/50"
                                  )}
                                >
                                  <WidgetIcon className="h-3 w-3" />
                                  <span>{meta.label}</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeWidget(row.id, block.id, widget.id);
                                    }}
                                    className="ml-1 rounded text-slate-400 hover:text-rose-600"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}

                            {/* Add Widget Button */}
                            <WidgetAdder
                              onAdd={(type) => addWidgetToBlock(row.id, block.id, type)}
                              usedTypes={usedWidgetTypes}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Row Background Color */}
                  <div className="mt-3 flex items-center gap-3 pt-3 border-t border-slate-100">
                    <label className="text-xs text-slate-500">{t("pages.homeSettings.header.background")}:</label>
                    <input
                      type="color"
                      value={row.backgroundColor || "#ffffff"}
                      onChange={(e) => updateRow(row.id, { backgroundColor: e.target.value })}
                      className="h-6 w-8 cursor-pointer rounded border border-slate-200"
                    />
                    <input
                      type="text"
                      value={row.backgroundColor || ""}
                      onChange={(e) => updateRow(row.id, { backgroundColor: e.target.value })}
                      placeholder="#ffffff"
                      className="w-24 rounded border border-slate-200 px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Row Button */}
          <button
            type="button"
            onClick={addRow}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm font-medium text-slate-500 transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            {t("pages.homeSettings.header.addRow")}
          </button>
          </div>
        </AccordionItem>

        {/* Available Widgets Accordion */}
        <AccordionItem
          title={t("pages.homeSettings.header.availableWidgets")}
          description={t("pages.homeSettings.header.availableWidgetsDesc")}
          defaultOpen={false}
          badge={
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {Object.keys(HEADER_WIDGET_LIBRARY).length} widgets
            </span>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {(Object.entries(HEADER_WIDGET_LIBRARY) as [HeaderWidgetType, typeof HEADER_WIDGET_LIBRARY[HeaderWidgetType]][]).map(
              ([type, meta]) => {
                const Icon = WIDGET_ICONS[type];
                const isUsed = usedWidgetTypes.has(type) && !meta.allowMultiple;
                return (
                  <div
                    key={type}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border p-2",
                      isUsed
                        ? "border-slate-100 bg-slate-50 text-slate-400"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{meta.label}</div>
                      <div className="text-[10px] text-slate-500 truncate">{meta.description}</div>
                    </div>
                    {isUsed && (
                      <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                    )}
                  </div>
                );
              }
            )}
          </div>
        </AccordionItem>

        {/* Header Preview Accordion */}
        <AccordionItem
          title={t("pages.homeSettings.header.headerPreview")}
          description={t("pages.homeSettings.header.headerPreviewDesc")}
          defaultOpen={true}
          badge={
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
              Preview
            </span>
          }
        >
          {/* Header preview container */}
        <div className="bg-slate-100 p-4">
          <div className="rounded-lg overflow-hidden shadow-lg bg-white">
            {headerConfigDraft.rows.filter(r => r.enabled).map((row) => (
              <div
                key={row.id}
                className="border-b border-slate-200 last:border-b-0"
                style={{ backgroundColor: row.backgroundColor || "#ffffff" }}
              >
                <div className="mx-auto max-w-[1920px] px-4 flex items-center gap-2 py-3">
                  {row.blocks.map((block, blockIndex) => {
                    const widthPct = LAYOUT_WIDTHS[row.layout][blockIndex] || 100;
                    return (
                      <div
                        key={block.id}
                        className={cn(
                          "flex items-center gap-2 flex-wrap",
                          block.alignment === "left" && "justify-start",
                          block.alignment === "center" && "justify-center",
                          block.alignment === "right" && "justify-end"
                        )}
                        style={{ width: `${widthPct}%` }}
                      >
                        {block.widgets.map((widget) => {
                          const Icon = WIDGET_ICONS[widget.type];
                          const meta = HEADER_WIDGET_LIBRARY[widget.type];
                          const config = widget.config as Record<string, unknown>;

                          // Render widget preview based on type
                          if (widget.type === "logo") {
                            return (
                              <div key={widget.id} className="flex items-center gap-2">
                                {branding.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={branding.logo} alt={branding.title} className="h-10 w-auto" />
                                ) : (
                                  <div className="flex items-center gap-2 text-slate-600">
                                    <Image className="h-5 w-5" />
                                    <span className="font-semibold">{branding.title}</span>
                                  </div>
                                )}
                              </div>
                            );
                          }

                          if (widget.type === "search-bar") {
                            return (
                              <div key={widget.id} className="flex-1 max-w-md">
                                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                  <Search className="h-4 w-4 text-slate-400" />
                                  <span className="text-sm text-slate-400">Search products...</span>
                                </div>
                              </div>
                            );
                          }

                          if (widget.type === "button") {
                            const label = (config.label as string) || "Button";
                            const variant = (config.variant as string) || "outline";
                            const backgroundColor = (config.backgroundColor as string) || "#009f7f";
                            const textColor = (config.textColor as string) || "#ffffff";
                            return (
                              <button
                                key={widget.id}
                                type="button"
                                className={cn(
                                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                                  variant === "primary" && "text-white",
                                  variant === "secondary" && "bg-slate-100 text-slate-700",
                                  variant === "outline" && "border border-slate-200 text-slate-700",
                                  variant === "ghost" && "text-slate-700 hover:bg-slate-100"
                                )}
                                style={
                                  variant === "primary"
                                    ? { backgroundColor: branding.primaryColor }
                                    : variant === "custom"
                                    ? { backgroundColor, color: textColor }
                                    : undefined
                                }
                              >
                                {label}
                              </button>
                            );
                          }

                          if (widget.type === "category-menu") {
                            const label = (config.label as string) || "Categories";
                            return (
                              <button
                                key={widget.id}
                                type="button"
                                className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium bg-slate-100 text-slate-700"
                              >
                                <Menu className="h-4 w-4" />
                                {label}
                              </button>
                            );
                          }

                          if (widget.type === "radio-widget") {
                            const radioConfig = config as { enabled?: boolean; headerIcon?: string; stations?: RadioStation[] };
                            const enabled = radioConfig.enabled !== false;
                            if (!enabled) return null;
                            return (
                              <button
                                key={widget.id}
                                type="button"
                                className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                                title="Radio Player"
                              >
                                {radioConfig.headerIcon ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={radioConfig.headerIcon} alt="Radio" className="h-10 w-auto" />
                                ) : (
                                  <Radio className="h-6 w-6 text-slate-600" />
                                )}
                              </button>
                            );
                          }

                          // Icon widgets (cart, favorites, compare, profile, no-price)
                          return (
                            <button
                              key={widget.id}
                              type="button"
                              className="rounded-md p-2 text-slate-600 hover:bg-slate-100"
                              title={meta.label}
                            >
                              <Icon className="h-5 w-5" />
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {headerConfigDraft.rows.filter(r => r.enabled).length === 0 && (
              <div className="p-8 text-center text-sm text-slate-400">
                {t("pages.homeSettings.header.noRowsEnabled")}
              </div>
            )}
          </div>
        </div>
        </AccordionItem>
      </AccordionGroup>
        </div>

        {/* Right Column - Widget Configuration Panel */}
        {selectedWidget && (
          <div className="w-80 shrink-0">
            <div className="sticky top-4">
              <WidgetConfigPanel
                headerConfig={headerConfigDraft}
                selectedWidget={selectedWidget}
                onUpdate={onDraftChange}
                onClose={() => setSelectedWidget(null)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface WidgetAdderProps {
  onAdd: (type: HeaderWidgetType) => void;
  usedTypes: Set<HeaderWidgetType>;
}

function WidgetAdder({ onAdd, usedTypes }: WidgetAdderProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  const availableWidgets = (Object.entries(HEADER_WIDGET_LIBRARY) as [HeaderWidgetType, typeof HEADER_WIDGET_LIBRARY[HeaderWidgetType]][])
    .filter(([type, meta]) => meta.allowMultiple || !usedTypes.has(type));

  if (availableWidgets.length === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-center rounded-md border border-dashed border-slate-300 p-1 text-slate-400 transition-colors hover:border-primary hover:text-primary"
      >
        <Plus className="h-4 w-4" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-3 py-2">
              <span className="text-xs font-medium text-slate-600">{t("pages.homeSettings.header.addWidget")}</span>
            </div>
            <div className="max-h-80 overflow-y-auto p-1.5">
              {availableWidgets.map(([type, meta]) => {
                const Icon = WIDGET_ICONS[type];
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onAdd(type);
                      setIsOpen(false);
                    }}
                    className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100">
                      <Icon className="h-4 w-4 text-slate-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-slate-700">{meta.label}</div>
                      <div className="text-xs text-slate-500 truncate">{meta.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface WidgetConfigPanelProps {
  headerConfig: HeaderConfig;
  selectedWidget: { rowId: string; blockId: string; widgetId: string };
  onUpdate: (config: HeaderConfig) => void;
  onClose: () => void;
}

function WidgetConfigPanel({ headerConfig, selectedWidget, onUpdate, onClose }: WidgetConfigPanelProps) {
  const { t } = useTranslation();
  const radioLogoUploader = useImageUpload();
  const row = headerConfig.rows.find((r) => r.id === selectedWidget.rowId);
  const block = row?.blocks.find((b) => b.id === selectedWidget.blockId);
  const widget = block?.widgets.find((w) => w.id === selectedWidget.widgetId);

  if (!widget || !block) return null;

  const meta = HEADER_WIDGET_LIBRARY[widget.type];
  const Icon = WIDGET_ICONS[widget.type];

  // Get current position (1-based for display)
  const currentIndex = block.widgets.findIndex((w) => w.id === selectedWidget.widgetId);
  const currentPosition = currentIndex + 1;
  const totalWidgets = block.widgets.length;

  const updateWidgetConfig = (updates: Record<string, unknown>) => {
    onUpdate({
      ...headerConfig,
      rows: headerConfig.rows.map((r) =>
        r.id === selectedWidget.rowId
          ? {
              ...r,
              blocks: r.blocks.map((b) =>
                b.id === selectedWidget.blockId
                  ? {
                      ...b,
                      widgets: b.widgets.map((w) =>
                        w.id === selectedWidget.widgetId
                          ? { ...w, config: { ...w.config, ...updates } }
                          : w
                      ),
                    }
                  : b
              ),
            }
          : r
      ),
    });
  };

  const moveWidgetToPosition = (newPosition: number) => {
    // Convert to 0-based index
    const newIndex = Math.max(0, Math.min(newPosition - 1, totalWidgets - 1));
    if (newIndex === currentIndex) return;

    const newWidgets = [...block.widgets];
    const [movedWidget] = newWidgets.splice(currentIndex, 1);
    newWidgets.splice(newIndex, 0, movedWidget);

    onUpdate({
      ...headerConfig,
      rows: headerConfig.rows.map((r) =>
        r.id === selectedWidget.rowId
          ? {
              ...r,
              blocks: r.blocks.map((b) =>
                b.id === selectedWidget.blockId
                  ? { ...b, widgets: newWidgets }
                  : b
              ),
            }
          : r
      ),
    });
  };

  return (
    <SectionCard
      title={`${t("pages.homeSettings.widgets.configure")}: ${meta.label}`}
      description={meta.description}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
          <Icon className="h-5 w-5 text-slate-500" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-slate-700">{meta.label}</div>
            <div className="text-xs text-slate-500">Widget ID: {widget.id}</div>
          </div>
          {/* Position controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => moveWidgetToPosition(currentPosition - 1)}
              disabled={currentPosition === 1}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Move left"
            >
              <ChevronUp className="h-4 w-4 -rotate-90" />
            </button>
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1">
              <input
                type="number"
                min={1}
                max={totalWidgets}
                value={currentPosition}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) moveWidgetToPosition(val);
                }}
                className="w-6 text-center text-xs font-medium text-slate-700 focus:outline-none"
              />
              <span className="text-xs text-slate-400">/ {totalWidgets}</span>
            </div>
            <button
              type="button"
              onClick={() => moveWidgetToPosition(currentPosition + 1)}
              disabled={currentPosition === totalWidgets}
              className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Move right"
            >
              <ChevronDown className="h-4 w-4 -rotate-90" />
            </button>
          </div>
        </div>

        {/* Widget-specific configuration */}
        {widget.type === "button" && (() => {
          const config = (widget.config || {}) as { label?: string; url?: string; target?: string; variant?: string; backgroundColor?: string; textColor?: string };
          return (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.label")}</label>
                <input
                  type="text"
                  value={config.label || ""}
                  onChange={(e) => updateWidgetConfig({ label: e.target.value })}
                  placeholder={t("pages.homeSettings.widgets.buttonText")}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.url")}</label>
                <input
                  type="text"
                  value={config.url || ""}
                  onChange={(e) => updateWidgetConfig({ url: e.target.value })}
                  placeholder="https://example.com or /path"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.openIn")}</label>
                <select
                  value={config.target || "_self"}
                  onChange={(e) => updateWidgetConfig({ target: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="_self">{t("pages.homeSettings.widgets.sameTab")}</option>
                  <option value="_blank">{t("pages.homeSettings.widgets.newTab")}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.variant")}</label>
                <select
                  value={config.variant || "primary"}
                  onChange={(e) => updateWidgetConfig({ variant: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="primary">{t("pages.homeSettings.widgets.variantPrimary")}</option>
                  <option value="secondary">{t("pages.homeSettings.widgets.variantSecondary")}</option>
                  <option value="outline">{t("pages.homeSettings.widgets.variantOutline")}</option>
                  <option value="ghost">{t("pages.homeSettings.widgets.variantGhost")}</option>
                  <option value="custom">{t("pages.homeSettings.widgets.variantCustom")}</option>
                </select>
              </div>
              {config.variant === "custom" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.branding.backgroundColor")}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={config.backgroundColor || "#009f7f"}
                        onChange={(e) => updateWidgetConfig({ backgroundColor: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={config.backgroundColor || "#009f7f"}
                        onChange={(e) => updateWidgetConfig({ backgroundColor: e.target.value })}
                        placeholder="#009f7f"
                        className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.branding.textColor")}</label>
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="color"
                        value={config.textColor || "#ffffff"}
                        onChange={(e) => updateWidgetConfig({ textColor: e.target.value })}
                        className="h-8 w-10 cursor-pointer rounded border border-slate-200"
                      />
                      <input
                        type="text"
                        value={config.textColor || "#ffffff"}
                        onChange={(e) => updateWidgetConfig({ textColor: e.target.value })}
                        placeholder="#ffffff"
                        className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {widget.type === "search-bar" && (() => {
          const config = (widget.config || {}) as { placeholder?: string; width?: string };
          return (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.placeholder")}</label>
                <input
                  type="text"
                  value={config.placeholder || ""}
                  onChange={(e) => updateWidgetConfig({ placeholder: e.target.value })}
                  placeholder="Search products..."
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.width")}</label>
                <select
                  value={config.width || "lg"}
                  onChange={(e) => updateWidgetConfig({ width: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="sm">{t("pages.homeSettings.product.sizeSmall")}</option>
                  <option value="md">{t("pages.homeSettings.product.sizeMedium")}</option>
                  <option value="lg">{t("pages.homeSettings.product.sizeLarge")}</option>
                  <option value="full">{t("pages.homeSettings.widgets.widthFull")}</option>
                </select>
              </div>
            </div>
          );
        })()}

        {widget.type === "category-menu" && (() => {
          const config = (widget.config || {}) as { label?: string };
          return (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.widgets.label")}</label>
                <input
                  type="text"
                  value={config.label || ""}
                  onChange={(e) => updateWidgetConfig({ label: e.target.value })}
                  placeholder="Categories"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
            </div>
          );
        })()}

        {widget.type === "radio-widget" && (() => {
          const config = (widget.config || {}) as { enabled?: boolean; headerIcon?: string; stations?: RadioStation[] };
          const stations = config.stations || [];

          const addStation = () => {
            const newStation: RadioStation = {
              id: `station-${Date.now()}`,
              name: "",
              logoUrl: "",
              streamUrl: "",
            };
            updateWidgetConfig({ stations: [...stations, newStation] });
          };

          const updateStation = (stationId: string, updates: Partial<RadioStation>) => {
            updateWidgetConfig({
              stations: stations.map((s) =>
                s.id === stationId ? { ...s, ...updates } : s
              ),
            });
          };

          const removeStation = (stationId: string) => {
            updateWidgetConfig({
              stations: stations.filter((s) => s.id !== stationId),
            });
          };

          const handleHeaderIconUpload = async (file: File) => {
            const url = await radioLogoUploader.uploadImage(file);
            if (url) {
              updateWidgetConfig({ headerIcon: url });
            }
          };

          const handleStationLogoUpload = async (stationId: string, file: File) => {
            const url = await radioLogoUploader.uploadImage(file);
            if (url) {
              updateStation(stationId, { logoUrl: url });
            }
          };

          return (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.enabled !== false}
                  onChange={(e) => updateWidgetConfig({ enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">{t("common.enabled")}</span>
              </label>

              {/* Header Icon */}
              <div>
                <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.radio.headerIcon")}</label>
                <p className="text-[10px] text-slate-400 mb-2">{t("pages.homeSettings.radio.headerIconHelper")}</p>
                {config.headerIcon && (
                  <div className="mb-2 flex justify-center">
                    <div className="h-24 w-24 rounded border border-slate-200 bg-white p-1">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={config.headerIcon}
                        alt="Radio icon"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={config.headerIcon || ""}
                    onChange={(e) => updateWidgetConfig({ headerIcon: e.target.value })}
                    placeholder="/assets/radio-icon.png"
                    className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                  />
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleHeaderIconUpload(file);
                          e.target.value = "";
                        }
                      }}
                    />
                    <span className="flex h-8 w-8 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                      <Upload className="h-4 w-4" />
                    </span>
                  </label>
                </div>
                {radioLogoUploader.uploadState.isUploading && (
                  <p className="mt-1 text-[10px] text-slate-400">{t("pages.homeSettings.branding.uploading")}</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">{t("pages.homeSettings.radio.stations")}</label>
                  <button
                    type="button"
                    onClick={addStation}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" />
                    {t("pages.homeSettings.radio.addStation")}
                  </button>
                </div>

                {stations.length === 0 ? (
                  <div className="rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
                    No stations configured. Click &quot;Add Station&quot; to add one.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stations.map((station, index) => (
                      <div
                        key={station.id}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-700">
                            Station {index + 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeStation(station.id)}
                            className="p-1 text-slate-400 hover:text-red-500"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div>
                            <label className="text-[10px] font-medium text-slate-500">{t("pages.homeSettings.radio.stationName")}</label>
                            <input
                              type="text"
                              value={station.name}
                              onChange={(e) => updateStation(station.id, { name: e.target.value })}
                              placeholder="Radio Italia"
                              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-500">{t("pages.homeSettings.branding.logo")}</label>
                            <div className="mt-0.5 flex items-center gap-2">
                              {station.logoUrl && (
                                <div className="h-8 w-8 flex-shrink-0 rounded border border-slate-200 bg-white p-0.5">
                                  <img
                                    src={station.logoUrl}
                                    alt={station.name || "Station logo"}
                                    className="h-full w-full object-contain"
                                  />
                                </div>
                              )}
                              <input
                                type="text"
                                value={station.logoUrl}
                                onChange={(e) => updateStation(station.id, { logoUrl: e.target.value })}
                                placeholder="/assets/radio-logo.png"
                                className="flex-1 rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                              />
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleStationLogoUpload(station.id, file);
                                      e.target.value = "";
                                    }
                                  }}
                                />
                                <span className="flex h-7 w-7 items-center justify-center rounded border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                                  <Upload className="h-3.5 w-3.5" />
                                </span>
                              </label>
                            </div>
                            {radioLogoUploader.uploadState.isUploading && (
                              <p className="mt-1 text-[10px] text-slate-400">{t("pages.homeSettings.branding.uploading")}</p>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-500">{t("pages.homeSettings.radio.streamUrl")}</label>
                            <input
                              type="text"
                              value={station.streamUrl}
                              onChange={(e) => updateStation(station.id, { streamUrl: e.target.value })}
                              placeholder="https://stream.radioitalia.it/stream"
                              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {(widget.type === "cart" || widget.type === "favorites" || widget.type === "compare" || widget.type === "profile" || widget.type === "no-price" || widget.type === "notifications" || widget.type === "reminders") && (() => {
          const config = (widget.config || {}) as { showLabel?: boolean; showBadge?: boolean };
          return (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showLabel || false}
                  onChange={(e) => updateWidgetConfig({ showLabel: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">{t("pages.homeSettings.widgets.showLabel")}</span>
              </label>
              {widget.type !== "no-price" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBadge || false}
                    onChange={(e) => updateWidgetConfig({ showBadge: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-600">{t("pages.homeSettings.widgets.showBadge")}</span>
                </label>
              )}
            </div>
          );
        })()}

        {widget.type === "company-info" && (() => {
          const config = (widget.config || {}) as { showDeliveryAddress?: boolean; showBalance?: boolean };
          return (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showDeliveryAddress || false}
                  onChange={(e) => updateWidgetConfig({ showDeliveryAddress: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">{t("pages.homeSettings.widgets.showDeliveryAddress")}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBalance || false}
                  onChange={(e) => updateWidgetConfig({ showBalance: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">{t("pages.homeSettings.widgets.showBalance")}</span>
              </label>
            </div>
          );
        })()}

        {(widget.type === "logo" || widget.type === "spacer" || widget.type === "divider") && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            {t("pages.homeSettings.widgets.noConfig")}
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-slate-500"
          >
            Close
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Branding Preview Component (Sidebar)
// ============================================================================

interface BrandingPreviewProps {
  branding: CompanyBranding;
  cardStyle: ProductCardStyle;
}

function BrandingPreview({ branding, cardStyle }: BrandingPreviewProps) {
  const { t } = useTranslation();
  return (
    <SectionCard
      title={t("pages.homeSettings.preview.brandingTitle")}
      description={t("pages.homeSettings.preview.brandingDescription")}
    >
      {/* Logo & Company Info */}
      <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50 flex-shrink-0">
          {branding.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt="Logo" className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] font-semibold uppercase text-slate-400">Logo</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900 truncate">
            {branding.title || "Your company"}
          </div>
          <div className="text-sm text-slate-500 truncate">
            {branding.shopUrl || "shop.example.com"}
          </div>
        </div>
      </div>

      {/* Colour Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Brand Colors */}
        <div className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Brand</div>
          <div className="flex flex-wrap gap-2">
            <div className="flex flex-col items-center gap-1">
              <span
                className="h-10 w-10 rounded-full border border-slate-200"
                style={{ backgroundColor: branding.primaryColor || "#009f7f" }}
              />
              <span className="text-[9px] text-slate-500">Primary</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span
                className="h-10 w-10 rounded-full border border-slate-200"
                style={{ backgroundColor: branding.secondaryColor || "#02b290" }}
              />
              <span className="text-[9px] text-slate-500">Secondary</span>
            </div>
          </div>
        </div>

        {/* Text Colors */}
        <div className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Text</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-medium"
                style={{ backgroundColor: branding.textColor || "#000000", color: "#fff" }}
              >
                Aa
              </div>
              <span className="text-xs text-slate-600">Body</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-full border border-slate-200 flex items-center justify-center text-[10px] font-medium"
                style={{ backgroundColor: branding.mutedColor || "#595959", color: "#fff" }}
              >
                Aa
              </div>
              <span className="text-xs text-slate-600">Muted</span>
            </div>
          </div>
        </div>

        {/* Layout Colors */}
        <div className="space-y-3">
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Layout</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded border border-slate-200"
                style={{ backgroundColor: branding.backgroundColor || "#ffffff" }}
              />
              <span className="text-xs text-slate-600">Background</span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded border border-slate-200"
                style={{ backgroundColor: branding.footerBackgroundColor || "#f5f5f5" }}
              />
              <span className="text-xs text-slate-600">Footer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Card Style Summary */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-3">Card Style</div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Border</span>
            <div className="font-medium text-slate-700">{cardStyle.borderWidth}px {cardStyle.borderStyle}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Radius</span>
            <div className="font-medium text-slate-700">{cardStyle.borderRadius}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Shadow</span>
            <div className="font-medium text-slate-700">{cardStyle.shadowSize}</div>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-slate-500">Hover</span>
            <div className="font-medium text-slate-700">{cardStyle.hoverEffect}</div>
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

// ============================================================================
// Product Card Preview Panel Component (Sidebar)
// ============================================================================

interface ProductCardPreviewPanelProps {
  cardStyle: ProductCardStyle;
  branding: CompanyBranding;
  previewVariant: PreviewVariant;
  onVariantChange: (variant: PreviewVariant) => void;
}

function ProductCardPreviewPanel({ cardStyle, branding, previewVariant, onVariantChange }: ProductCardPreviewPanelProps) {
  const { t } = useTranslation();
  const previewHeading = previewVariant === "horizontal"
    ? t("pages.homeSettings.preview.horizontalCard")
    : t("pages.homeSettings.preview.verticalCard");

  return (
    <SectionCard
      title={previewHeading}
      description={t("pages.homeSettings.preview.livePreview")}
    >
      <div className="flex gap-2 mb-4">
        {CARD_VARIANTS.map((variant) => (
          <button
            key={variant.value}
            type="button"
            onClick={() => onVariantChange(variant.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-[10px] font-medium transition-colors",
              previewVariant === variant.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            {t(variant.labelKey)}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <ProductCardPreview
          variant={previewVariant}
          cardStyle={cardStyle}
          branding={branding}
        />
      </div>
    </SectionCard>
  );
}
