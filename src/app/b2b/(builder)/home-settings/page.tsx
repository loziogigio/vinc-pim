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
  History
} from "lucide-react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { AccordionItem, AccordionGroup } from "@/components/ui/accordion";
import { cn } from "@/components/ui/utils";
import ProductCardPreview, { type PreviewVariant } from "@/components/home-settings/ProductCardPreview";
import type { CompanyBranding, ProductCardStyle, CDNCredentials, SMTPSettings, CompanyContactInfo, HeaderConfig, HeaderRow, HeaderBlock, HeaderWidget, RowLayout, HeaderWidgetType, BlockAlignment, MetaTags, RadioStation } from "@/lib/types/home-settings";
import { LAYOUT_WIDTHS, LAYOUT_BLOCK_COUNT, HEADER_WIDGET_LIBRARY } from "@/lib/types/home-settings";
import { useImageUpload, type UploadState } from "@/hooks/useImageUpload";

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

const CARD_VARIANTS: Array<{ value: PreviewVariant; label: string; helper: string }> = [
  {
    value: "b2b",
    label: "Vertical (B2B)",
    helper: "Optimised for grid layouts (3-4 columns)"
  },
  {
    value: "horizontal",
    label: "Horizontal",
    helper: "Great for lists and search results"
  }
];

type ActiveSection = "branding" | "product" | "cdn" | "smtp" | "company" | "apikeys" | "footer" | "header" | "seo";

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
  onClear
}: {
  id: string;
  label: string;
  value?: string;
  helper?: string;
  onChange: (value: string) => void;
  allowClear?: boolean;
  onClear?: () => void;
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
          Clear
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
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [cardVariant, setCardVariant] = useState<PreviewVariant>("b2b");
  const [cardStyle, setCardStyle] = useState<ProductCardStyle>(DEFAULT_CARD_STYLE);
  const [cdnCredentials, setCdnCredentials] = useState<CDNCredentials>(DEFAULT_CDN_CREDENTIALS);
  const [smtpSettings, setSmtpSettings] = useState<SMTPSettings>(DEFAULT_SMTP_SETTINGS);
  const [companyInfo, setCompanyInfo] = useState<CompanyContactInfo>(DEFAULT_COMPANY_INFO);
  const [footerHtml, setFooterHtml] = useState<string>("");
  const [footerHtmlDraft, setFooterHtmlDraft] = useState<string>("");
  const [headerConfig, setHeaderConfig] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [headerConfigDraft, setHeaderConfigDraft] = useState<HeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [metaTags, setMetaTags] = useState<MetaTags>(DEFAULT_META_TAGS);
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
        setToast("No settings found. Using defaults.");
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
      setDirty(false);
      setToast("Settings loaded.");
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
          company_info: companyInfo,
          footerHtmlDraft,
          headerConfigDraft,
          meta_tags: metaTags,
          lastModifiedBy: "admin"
        })
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      setDirty(false);
      setToast("Settings saved successfully.");
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

  const showInitialLoader = isLoading && !hasLoadedOnce;

  return showInitialLoader ? (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-slate-700">Loading home settings…</span>
      </div>
    </div>
  ) : (
    <>
      {/* Sub-header with page title and actions */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold text-slate-900">B2B Ecommerce - Brand & Settings</h1>
              {dirty ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Unsaved changes
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                  Synced
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Configure branding, SEO, layouts, and settings for your B2B storefront.
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
              Reload
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
              title={branding.shopUrl || "Set Shop URL in Branding section"}
            >
              <Eye className="h-4 w-4" />
              Preview storefront
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
                  Saving…
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
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
              label="Branding"
              description="Colors, logo, identity"
              active={activeSection === "branding"}
              onClick={() => setActiveSection("branding")}
            />
            <SidebarItem
              icon={Monitor}
              label="Product cards"
              description="Layout, borders, hover effects"
              active={activeSection === "product"}
              onClick={() => setActiveSection("product")}
            />
            <SidebarItem
              icon={Cloud}
              label="CDN Configuration"
              description="Storage credentials for uploads"
              active={activeSection === "cdn"}
              onClick={() => setActiveSection("cdn")}
            />
            <SidebarItem
              icon={Mail}
              label="SMTP Settings"
              description="Email sending configuration"
              active={activeSection === "smtp"}
              onClick={() => setActiveSection("smtp")}
            />
            <SidebarItem
              icon={Building2}
              label="Company Info"
              description="Contact details for email footers"
              active={activeSection === "company"}
              onClick={() => setActiveSection("company")}
            />
            <SidebarItem
              icon={Key}
              label="API Keys"
              description="Manage programmatic access"
              active={activeSection === "apikeys"}
              onClick={() => setActiveSection("apikeys")}
            />
            <SidebarItem
              icon={FileCode2}
              label="Footer"
              description="Custom footer HTML"
              active={activeSection === "footer"}
              onClick={() => setActiveSection("footer")}
            />
            <SidebarItem
              icon={LayoutTemplate}
              label="Header"
              description="Header rows & widgets"
              active={activeSection === "header"}
              onClick={() => setActiveSection("header")}
            />
            <SidebarItem
              icon={Globe}
              label="SEO & Meta Tags"
              description="Search engine optimization"
              active={activeSection === "seo"}
              onClick={() => setActiveSection("seo")}
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
            />
          )}
          {activeSection === "smtp" && (
            <SMTPForm
              smtpSettings={smtpSettings}
              onChange={updateSmtpSettings}
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
                  setToast("Footer published successfully.");
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
                  setToast("Header published successfully.");
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
      title="Branding"
      description="Define how your company is presented across the storefront."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="company-title" className="text-sm font-medium text-slate-600">
            Company title
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
            Appears in navigation, legal footer and browser metadata.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-slate-600">Logo</label>
              <p className="text-xs text-slate-500">Upload a square SVG/PNG. Max 20MB.</p>
            </div>
            {branding.logo ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-rose-600"
                onClick={() => onChange("logo", "")}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="Logo preview" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs font-semibold uppercase text-slate-400">Logo</span>
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
                {logoUpload.isUploading ? "Uploading…" : "Upload logo"}
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
              <label className="text-sm font-medium text-slate-600">Favicon</label>
              <p className="text-xs text-slate-500">Suggested 32×32 PNG/ICO.</p>
            </div>
            {branding.favicon ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-slate-500 hover:text-rose-600"
                onClick={() => onChange("favicon", "")}
              >
                Remove
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-50">
              {branding.favicon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.favicon} alt="Favicon preview" className="h-full w-full object-contain" />
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
                {faviconUpload.isUploading ? "Uploading…" : "Upload favicon"}
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
            Logo URL
          </label>
          <input
            id="logo-url"
            type="text"
            value={branding.logo || ""}
            onChange={(event) => onChange("logo", event.target.value)}
            placeholder="https://example.com/logo.svg"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">SVG or PNG, ideally with transparent background.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="favicon-url" className="text-sm font-medium text-slate-600">
            Favicon URL
          </label>
          <input
            id="favicon-url"
            type="text"
            value={branding.favicon || ""}
            onChange={(event) => onChange("favicon", event.target.value)}
            placeholder="https://example.com/favicon.ico"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">Square image (32×32 or 64×64) for browser tabs.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="shop-url" className="text-sm font-medium text-slate-600">
            Shop URL
          </label>
          <input
            id="shop-url"
            type="url"
            value={branding.shopUrl || ""}
            onChange={(event) => onChange("shopUrl", event.target.value)}
            placeholder="https://shop.example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">Storefront URL for email links and redirects.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="website-url" className="text-sm font-medium text-slate-600">
            Company Website
          </label>
          <input
            id="website-url"
            type="url"
            value={branding.websiteUrl || ""}
            onChange={(event) => onChange("websiteUrl", event.target.value)}
            placeholder="https://www.example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">Main company website URL.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ColorInput
          id="primary-color"
          label="Primary colour"
          value={branding.primaryColor}
          onChange={(value) => onChange("primaryColor", value)}
          helper="Buttons, highlights and active states."
        />
        <ColorInput
          id="secondary-color"
          label="Secondary colour"
          value={branding.secondaryColor}
          onChange={(value) => onChange("secondaryColor", value)}
          helper="Badges, accents and hover states."
        />
      </div>

      {/* Extended Theme Colours */}
      <details className="group rounded-xl border border-slate-200 bg-slate-50/50">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-slate-700 hover:text-slate-900">
          <Palette className="h-4 w-4" />
          Extended Theme Colours
          <span className="ml-auto text-xs text-slate-400 group-open:hidden">Click to expand</span>
        </summary>
        <div className="grid gap-4 border-t border-slate-200 px-4 py-4 md:grid-cols-2">
          <ColorInput
            id="accent-color"
            label="Accent colour"
            value={branding.accentColor}
            onChange={(value) => onChange("accentColor", value)}
            helper="Buttons, links and CTAs."
            allowClear
            onClear={() => onChange("accentColor", "")}
          />
          <ColorInput
            id="text-color"
            label="Text colour"
            value={branding.textColor}
            onChange={(value) => onChange("textColor", value)}
            helper="Main body text (default: #000000)."
            allowClear
            onClear={() => onChange("textColor", "")}
          />
          <ColorInput
            id="muted-color"
            label="Muted colour"
            value={branding.mutedColor}
            onChange={(value) => onChange("mutedColor", value)}
            helper="Secondary/muted text (default: #595959)."
            allowClear
            onClear={() => onChange("mutedColor", "")}
          />
          <ColorInput
            id="background-color"
            label="Background colour"
            value={branding.backgroundColor}
            onChange={(value) => onChange("backgroundColor", value)}
            helper="Page background (default: #ffffff)."
            allowClear
            onClear={() => onChange("backgroundColor", "")}
          />
          <ColorInput
            id="header-bg-color"
            label="Header background"
            value={branding.headerBackgroundColor}
            onChange={(value) => onChange("headerBackgroundColor", value)}
            helper="Header background (empty = inherit)."
            allowClear
            onClear={() => onChange("headerBackgroundColor", "")}
          />
          <ColorInput
            id="footer-bg-color"
            label="Footer background"
            value={branding.footerBackgroundColor}
            onChange={(value) => onChange("footerBackgroundColor", value)}
            helper="Footer background (default: #f5f5f5)."
            allowClear
            onClear={() => onChange("footerBackgroundColor", "")}
          />
          <ColorInput
            id="footer-text-color"
            label="Footer text colour"
            value={branding.footerTextColor}
            onChange={(value) => onChange("footerTextColor", value)}
            helper="Footer text (default: #666666)."
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
  return (
    <SectionCard
      title="Product cards"
      description="Control how catalogue items appear to your customers."
    >
      <div className="space-y-4">
        <label className="text-sm font-medium text-slate-600">Default layout</label>
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
                    <div className="text-sm font-semibold">{variant.label}</div>
                    <div className="text-xs text-slate-500">{variant.helper}</div>
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
            Border width: {cardStyle.borderWidth}px
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
          label="Border colour"
          value={cardStyle.borderColor}
          onChange={(value) => onStyleChange("borderColor", value)}
        />

        <div className="space-y-2">
          <label htmlFor="border-style" className="text-sm font-medium text-slate-600">
            Border style
          </label>
          <select
            id="border-style"
            value={cardStyle.borderStyle}
            onChange={(event) =>
              onStyleChange("borderStyle", event.target.value as ProductCardStyle["borderStyle"])
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
            <option value="none">None</option>
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="border-radius" className="text-sm font-medium text-slate-600">
            Border radius
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
            <option value="none">Sharp</option>
            <option value="sm">Slightly rounded</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
            <option value="xl">Extra large</option>
            <option value="2xl">Pill</option>
            <option value="full">Circle</option>
          </select>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="shadow-size" className="text-sm font-medium text-slate-600">
            Shadow size
          </label>
          <select
            id="shadow-size"
            value={cardStyle.shadowSize}
            onChange={(event) =>
              onStyleChange("shadowSize", event.target.value as ProductCardStyle["shadowSize"])
            }
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="none">None</option>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
            <option value="xl">Extra large</option>
            <option value="2xl">Huge</option>
          </select>
        </div>

        <ColorInput
          id="shadow-color"
          label="Shadow colour"
          value={cardStyle.shadowColor}
          onChange={(value) => onStyleChange("shadowColor", value)}
        />
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="hover-effect" className="text-sm font-medium text-slate-600">
            Hover effect
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
            <option value="none">None</option>
            <option value="lift">Lift up</option>
            <option value="shadow">Add shadow</option>
            <option value="scale">Scale</option>
            <option value="border">Highlight border</option>
            <option value="glow">Glow</option>
          </select>
        </div>

        {cardStyle.hoverEffect === "scale" ? (
          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-600">
              Hover scale: {(cardStyle.hoverScale ?? 1.02).toFixed(2)}×
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
              Hover shadow size
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
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
              <option value="xl">Extra large</option>
              <option value="2xl">Huge</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ColorInput
          id="background-color"
          label="Background colour"
          value={cardStyle.backgroundColor}
          onChange={(value) => onStyleChange("backgroundColor", value)}
        />
        <ColorInput
          id="hover-background-color"
          label="Hover background"
          value={cardStyle.hoverBackgroundColor}
          onChange={(value) => onStyleChange("hoverBackgroundColor", value)}
          helper="Optional colour when the card is hovered."
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
          Reset style to defaults
        </Button>
      </div>
    </SectionCard>
  );
}

interface CDNFormProps {
  cdnCredentials: CDNCredentials;
  onChange: <K extends keyof CDNCredentials>(key: K, value: CDNCredentials[K]) => void;
}

function CDNForm({ cdnCredentials, onChange }: CDNFormProps) {
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
      title="CDN Configuration"
      description="Configure S3-compatible storage credentials for file uploads."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="md:col-span-2 space-y-2">
          <label htmlFor="cdn-url" className="text-sm font-medium text-slate-600">
            CDN Endpoint URL
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
            S3-compatible endpoint URL (e.g., IBM Cloud Object Storage, AWS S3, MinIO)
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="bucket-region" className="text-sm font-medium text-slate-600">
            Bucket Region
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
            Bucket Name
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
            Folder Name (optional)
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
            Prefix folder for all uploaded files
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-key" className="text-sm font-medium text-slate-600">
            Access Key ID
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
            Secret Access Key
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
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Advanced Settings</h3>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="signed-url-expiry" className="text-sm font-medium text-slate-600">
              Signed URL Expiry (seconds)
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
              0 = public URLs (no expiry)
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">
              Delete from Cloud
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
                {cdnCredentials.delete_from_cloud ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Delete files from cloud storage when removed from database
            </p>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Test Connection</h3>
            <p className="text-xs text-slate-500">
              Verify credentials by uploading and deleting a test file
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
                Testing...
              </>
            ) : (
              "Test Connection"
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
          </div>
        )}
      </div>
    </SectionCard>
  );
}

interface SMTPFormProps {
  smtpSettings: SMTPSettings;
  onChange: <K extends keyof SMTPSettings>(key: K, value: SMTPSettings[K]) => void;
}

function SMTPForm({ smtpSettings, onChange }: SMTPFormProps) {
  const [isTesting, setIsTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
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
    } catch (error) {
      setTestResult({
        success: false,
        message: "Failed to test connection. Please check your network.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Allow localhost without auth for local dev testing (MailHog, Mailpit)
  const isLocalhost = smtpSettings.host === "localhost" || smtpSettings.host === "127.0.0.1";
  const hasAuth = smtpSettings.user && smtpSettings.password;
  const canTest = smtpSettings.host && smtpSettings.port && smtpSettings.from &&
                  (hasAuth || isLocalhost);

  return (
    <SectionCard
      title="SMTP Settings"
      description="Configure email sending for notifications and transactional emails."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="smtp-host" className="text-sm font-medium text-slate-600">
            SMTP Host
          </label>
          <input
            id="smtp-host"
            type="text"
            value={smtpSettings.host || ""}
            onChange={(e) => onChange("host", e.target.value)}
            placeholder="smtp.example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-port" className="text-sm font-medium text-slate-600">
            Port
          </label>
          <input
            id="smtp-port"
            type="number"
            value={smtpSettings.port || 587}
            onChange={(e) => onChange("port", Number(e.target.value))}
            placeholder="587"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            Common ports: 587 (STARTTLS), 465 (SSL/TLS)
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-user" className="text-sm font-medium text-slate-600">
            Username
          </label>
          <input
            id="smtp-user"
            type="text"
            value={smtpSettings.user || ""}
            onChange={(e) => onChange("user", e.target.value)}
            placeholder="noreply@example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-password" className="text-sm font-medium text-slate-600">
            Password
          </label>
          <input
            id="smtp-password"
            type="password"
            value={smtpSettings.password || ""}
            onChange={(e) => onChange("password", e.target.value)}
            placeholder="••••••••••••"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-from" className="text-sm font-medium text-slate-600">
            From Email
          </label>
          <input
            id="smtp-from"
            type="email"
            value={smtpSettings.from || ""}
            onChange={(e) => onChange("from", e.target.value)}
            placeholder="noreply@example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-from-name" className="text-sm font-medium text-slate-600">
            From Name
          </label>
          <input
            id="smtp-from-name"
            type="text"
            value={smtpSettings.from_name || ""}
            onChange={(e) => onChange("from_name", e.target.value)}
            placeholder="My Company"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="smtp-default-to" className="text-sm font-medium text-slate-600">
            Default Recipient
          </label>
          <input
            id="smtp-default-to"
            type="email"
            value={smtpSettings.default_to || ""}
            onChange={(e) => onChange("default_to", e.target.value)}
            placeholder="info@example.com"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            For system notifications and alerts
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">
            Secure Connection (TLS)
          </label>
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => onChange("secure", !smtpSettings.secure)}
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
              {smtpSettings.secure ? "Enabled (port 465)" : "Disabled (port 587)"}
            </span>
          </div>
        </div>
      </div>

      {/* Test Connection */}
      <div className="border-t border-slate-200 pt-6 mt-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Test Connection</h3>
            <p className="text-xs text-slate-500">
              Send a test email to verify SMTP credentials
            </p>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <label htmlFor="test-email" className="text-sm font-medium text-slate-600">
                Send test to
              </label>
              <input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder={smtpSettings.default_to || smtpSettings.from || "test@example.com"}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleTestConnection}
              disabled={!canTest || isTesting}
              className="gap-2 h-[38px]"
            >
              {isTesting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Test Email"
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
  return (
    <SectionCard
      title="Company Contact Info"
      description="Contact information displayed in email footers and used for legal compliance."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="company-legal-name" className="text-sm font-medium text-slate-600">
            Legal Company Name
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
            Official registered company name
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-vat" className="text-sm font-medium text-slate-600">
            VAT Number / P.IVA
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
            Address Line 1
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
            Address Line 2
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
            City, ZIP, Country
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-phone" className="text-sm font-medium text-slate-600">
            Phone Number
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
            General Email
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
            Support Email
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
            For customer support inquiries
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-hours" className="text-sm font-medium text-slate-600">
            Business Hours
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
        <h4 className="text-sm font-semibold text-slate-900">Email Footer Preview</h4>
        <p className="text-xs text-slate-500 mb-3">This is how your company info will appear in email footers</p>
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
    if (!dateString) return "Never";
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
      title="API Keys"
      description="Manage API keys for programmatic access to your B2B APIs."
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
                <h4 className="font-semibold text-amber-800">Save your API credentials now!</h4>
                <p className="text-sm text-amber-700">
                  The secret will not be shown again. Store it securely.
                </p>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="text-xs font-medium text-amber-700">API Key</label>
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
                  <label className="text-xs font-medium text-amber-700">API Secret</label>
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
                I&apos;ve saved the credentials
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Your API Keys</h3>
          <Button
            type="button"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create New Key
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : keys.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-8 text-center">
            <Key className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm text-slate-600">No API keys yet</p>
            <p className="text-xs text-slate-500">Create your first API key to enable programmatic access</p>
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
                        {key.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs font-mono text-slate-500 truncate">
                      {key.key_id}
                    </p>
                    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500">
                      <span>Created: {formatDate(key.created_at)}</span>
                      <span>Last used: {formatDate(key.last_used_at)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {key.permissions.map((perm) => (
                        <span
                          key={perm}
                          className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                        >
                          {perm === "*" ? "Full Access" : perm}
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
            <h3 className="text-lg font-semibold text-slate-900">Create New API Key</h3>
            <p className="mt-1 text-sm text-slate-500">
              Generate a new API key for programmatic access.
            </p>

            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="key-name" className="text-sm font-medium text-slate-600">
                  Key Name
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
                <label className="text-sm font-medium text-slate-600">Permissions</label>
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
                    Creating...
                  </>
                ) : (
                  "Create Key"
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
                <h3 className="text-lg font-semibold text-slate-900">Delete API Key</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Are you sure you want to delete <strong>{keyToDelete.name}</strong>? This action
                  cannot be undone and any systems using this key will lose access.
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
                    Deleting...
                  </>
                ) : (
                  "Delete Key"
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
              Draft has unpublished changes
            </span>
          ) : footerHtml ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Published
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              No footer configured
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
              Revert to Published
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
                Publishing...
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

      {/* Accordion Sections */}
      <AccordionGroup>
        {/* HTML Editor Accordion */}
        <AccordionItem
          title="HTML Editor"
          description="Write custom HTML with Tailwind CSS classes"
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
              Use Tailwind CSS classes for styling. HTML is sanitized with DOMPurify before rendering.
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDraftChange(exampleHtml)}
                className="text-xs"
              >
                Load Example
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
          title="Footer Images"
          description="Upload images to use in your footer HTML"
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
                    Uploading...
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
                <p className="text-sm text-slate-500">No images uploaded yet</p>
                <p className="text-xs text-slate-400">Click "Upload" to add images for your footer</p>
              </div>
            )}
          </div>
        </AccordionItem>

        {/* Live Preview Accordion */}
        <AccordionItem
          title="Live Preview"
          description="See how your footer will appear on the storefront"
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
                    Enter HTML above to see a preview
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
  "button": Square,
  "spacer": Space,
  "divider": Minus,
};

// ============================================================================
// Meta Tags Form Component
// ============================================================================

function MetaTagsForm({ metaTags, onChange }: MetaTagsFormProps) {
  return (
    <div className="space-y-6">
      {/* Basic SEO */}
      <SectionCard title="Basic SEO" description="Essential meta tags for search engines">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="meta-title" className="text-sm font-medium text-slate-600">
              Page Title
            </label>
            <input
              id="meta-title"
              type="text"
              value={metaTags.title || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="Your Company - B2B Store"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">Appears in browser tab and search results (50-60 characters recommended)</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label htmlFor="meta-description" className="text-sm font-medium text-slate-600">
              Meta Description
            </label>
            <textarea
              id="meta-description"
              value={metaTags.description || ""}
              onChange={(e) => onChange("description", e.target.value)}
              placeholder="A brief description of your B2B store for search results..."
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">Description shown in search results (150-160 characters recommended)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-keywords" className="text-sm font-medium text-slate-600">
              Keywords
            </label>
            <input
              id="meta-keywords"
              type="text"
              value={metaTags.keywords || ""}
              onChange={(e) => onChange("keywords", e.target.value)}
              placeholder="b2b, wholesale, products"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">Comma-separated keywords (less important for modern SEO)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-author" className="text-sm font-medium text-slate-600">
              Author
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
              Robots Directive
            </label>
            <select
              id="meta-robots"
              value={metaTags.robots || "index, follow"}
              onChange={(e) => onChange("robots", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            >
              <option value="index, follow">Index, Follow (default)</option>
              <option value="noindex, follow">No Index, Follow</option>
              <option value="index, nofollow">Index, No Follow</option>
              <option value="noindex, nofollow">No Index, No Follow</option>
            </select>
            <p className="text-xs text-slate-500">Controls how search engines crawl and index the site</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="meta-canonical" className="text-sm font-medium text-slate-600">
              Canonical URL
            </label>
            <input
              id="meta-canonical"
              type="url"
              value={metaTags.canonicalUrl || ""}
              onChange={(e) => onChange("canonicalUrl", e.target.value)}
              placeholder="https://shop.example.com"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">Preferred URL for the homepage</p>
          </div>
        </div>
      </SectionCard>

      {/* Open Graph */}
      <SectionCard title="Open Graph (Social Sharing)" description="How your site appears when shared on Facebook, LinkedIn, etc.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="og-title" className="text-sm font-medium text-slate-600">
              OG Title
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
              Site Name
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
              OG Description
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
              OG Image URL
            </label>
            <input
              id="og-image"
              type="url"
              value={metaTags.ogImage || ""}
              onChange={(e) => onChange("ogImage", e.target.value)}
              placeholder="https://cdn.example.com/og-image.jpg"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-primary focus:ring-1 focus:ring-primary"
            />
            <p className="text-xs text-slate-500">Recommended size: 1200x630 pixels (JPG or PNG)</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="og-type" className="text-sm font-medium text-slate-600">
              OG Type
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
      <SectionCard title="Twitter Card" description="How your site appears when shared on Twitter/X">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="twitter-card" className="text-sm font-medium text-slate-600">
              Card Type
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
              Site @username
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
              Creator @username
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
              Twitter Image URL
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
      <SectionCard title="Additional Settings" description="Theme color and site verification">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="theme-color" className="text-sm font-medium text-slate-600">
              Theme Color
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
            <p className="text-xs text-slate-500">Browser address bar color on mobile</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="google-verification" className="text-sm font-medium text-slate-600">
              Google Site Verification
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
              Bing Site Verification
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
      <SectionCard title="Structured Data (JSON-LD)" description="Advanced: Custom structured data for rich snippets">
        <div className="space-y-2">
          <label htmlFor="structured-data" className="text-sm font-medium text-slate-600">
            JSON-LD Structured Data
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
          <p className="text-xs text-slate-500">Optional JSON-LD for Organization, LocalBusiness, or other schema types</p>
        </div>
      </SectionCard>
    </div>
  );
}

function HeaderForm({ headerConfig, headerConfigDraft, branding, onDraftChange, onPublish }: HeaderFormProps) {
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
              Draft has unpublished changes
            </span>
          ) : headerConfig.rows.length > 0 ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
              Published
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              No header configured
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
              Revert to Published
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
                Publishing...
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
              title="Row Configuration"
              description="Configure header rows, layout, and widgets"
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
                  {row.fixed ? "Fixed" : "Scroll"}
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
                    <label className="text-xs text-slate-500">Background:</label>
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
            Add Row
          </button>
          </div>
        </AccordionItem>

        {/* Available Widgets Accordion */}
        <AccordionItem
          title="Available Widgets"
          description="Reference guide for header widgets. Click + in a block to add widgets."
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
          title="Header Preview"
          description="Preview of your header configuration"
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
                No header rows enabled. Add and enable rows above to see a preview.
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
              <span className="text-xs font-medium text-slate-600">Add Widget</span>
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
      title={`Configure: ${meta.label}`}
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
                <label className="text-xs font-medium text-slate-600">Label</label>
                <input
                  type="text"
                  value={config.label || ""}
                  onChange={(e) => updateWidgetConfig({ label: e.target.value })}
                  placeholder="Button text"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">URL</label>
                <input
                  type="text"
                  value={config.url || ""}
                  onChange={(e) => updateWidgetConfig({ url: e.target.value })}
                  placeholder="https://example.com or /path"
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Open In</label>
                <select
                  value={config.target || "_self"}
                  onChange={(e) => updateWidgetConfig({ target: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="_self">Same Tab</option>
                  <option value="_blank">New Tab</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Variant</label>
                <select
                  value={config.variant || "primary"}
                  onChange={(e) => updateWidgetConfig({ variant: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="primary">Primary</option>
                  <option value="secondary">Secondary</option>
                  <option value="outline">Outline</option>
                  <option value="ghost">Ghost</option>
                  <option value="custom">Custom Colors</option>
                </select>
              </div>
              {config.variant === "custom" && (
                <>
                  <div>
                    <label className="text-xs font-medium text-slate-600">Background Color</label>
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
                    <label className="text-xs font-medium text-slate-600">Text Color</label>
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
                <label className="text-xs font-medium text-slate-600">Placeholder</label>
                <input
                  type="text"
                  value={config.placeholder || ""}
                  onChange={(e) => updateWidgetConfig({ placeholder: e.target.value })}
                  placeholder="Search products..."
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Width</label>
                <select
                  value={config.width || "lg"}
                  onChange={(e) => updateWidgetConfig({ width: e.target.value })}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="full">Full</option>
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
                <label className="text-xs font-medium text-slate-600">Label</label>
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
                <span className="text-sm text-slate-600">Enabled</span>
              </label>

              {/* Header Icon */}
              <div>
                <label className="text-xs font-medium text-slate-600">Header Icon</label>
                <p className="text-[10px] text-slate-400 mb-2">Image shown in the header for the radio button</p>
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
                  <p className="mt-1 text-[10px] text-slate-400">Uploading...</p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-slate-600">Radio Stations</label>
                  <button
                    type="button"
                    onClick={addStation}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                  >
                    <Plus className="h-3 w-3" />
                    Add Station
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
                            <label className="text-[10px] font-medium text-slate-500">Station Name</label>
                            <input
                              type="text"
                              value={station.name}
                              onChange={(e) => updateStation(station.id, { name: e.target.value })}
                              placeholder="Radio Italia"
                              className="mt-0.5 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs focus:border-primary focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-500">Logo</label>
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
                              <p className="mt-1 text-[10px] text-slate-400">Uploading...</p>
                            )}
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-slate-500">Stream URL</label>
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
                <span className="text-sm text-slate-600">Show Label</span>
              </label>
              {widget.type !== "no-price" && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showBadge || false}
                    onChange={(e) => updateWidgetConfig({ showBadge: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-slate-600">Show Badge</span>
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
                <span className="text-sm text-slate-600">Show Delivery Address</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.showBalance || false}
                  onChange={(e) => updateWidgetConfig({ showBalance: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                />
                <span className="text-sm text-slate-600">Show Balance</span>
              </label>
            </div>
          );
        })()}

        {(widget.type === "logo" || widget.type === "spacer" || widget.type === "divider") && (
          <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
            This widget has no additional configuration options.
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
  return (
    <SectionCard
      title="Branding Preview"
      description="Theme colours and branding at a glance."
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
  const previewHeading = previewVariant === "horizontal"
    ? "Horizontal product card"
    : "Vertical product card";

  return (
    <SectionCard
      title={previewHeading}
      description="Live preview."
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
            {variant.label}
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
