"use client";

import { useEffect, useMemo, useState, useRef, useCallback, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Public_Sans } from "next/font/google";
import {
  ArrowLeft,
  Eye,
  Loader2,
  Monitor,
  Palette,
  RefreshCcw,
  Save,
  Server,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/utils";
import ProductCardPreview, { type PreviewVariant } from "@/components/home-settings/ProductCardPreview";
import type { CompanyBranding, ProductCardStyle, CDNConfiguration } from "@/lib/types/home-settings";
import { useImageUpload, type UploadState } from "@/hooks/useImageUpload";

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap"
});

const DEFAULT_BRANDING: CompanyBranding = {
  title: "My Company",
  logo: "",
  favicon: "",
  primaryColor: "#009f7f",
  secondaryColor: "#02b290"
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

const DEFAULT_CDN_CONFIG: CDNConfiguration = {
  baseUrl: "",
  description: "",
  enabled: true
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

type ActiveSection = "branding" | "product" | "cdn";

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

interface CDNFormProps {
  cdnConfig: CDNConfiguration;
  onChange: (key: keyof CDNConfiguration, value: string | boolean) => void;
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
  const router = useRouter();
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING);
  const [cardVariant, setCardVariant] = useState<PreviewVariant>("b2b");
  const [cardStyle, setCardStyle] = useState<ProductCardStyle>(DEFAULT_CARD_STYLE);
  const [cdnConfig, setCdnConfig] = useState<CDNConfiguration>(DEFAULT_CDN_CONFIG);
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
        setCdnConfig(DEFAULT_CDN_CONFIG);
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
      setCdnConfig({
        ...DEFAULT_CDN_CONFIG,
        ...(data.cdn ?? {})
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

  const updateCdnConfig = (key: keyof CDNConfiguration, value: string | boolean) => {
    setCdnConfig((prev: CDNConfiguration) => ({ ...prev, [key]: value }));
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
          cdn: cdnConfig,
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

  const previewHeading = useMemo(
    () =>
      previewVariant === "horizontal"
        ? "Horizontal product card"
        : "Vertical product card",
    [previewVariant]
  );

  return showInitialLoader ? (
    <div className="flex min-h-screen items-center justify-center bg-[#f5f6fa]">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="text-sm font-medium text-slate-700">Loading home settings…</span>
      </div>
    </div>
  ) : (
    <div className={cn("min-h-screen bg-[#f5f6fa] text-slate-900", publicSans.className)}>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-slate-500 hover:text-slate-900"
              onClick={() => router.push("/b2b/home-builder")}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back to builder</span>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-semibold text-slate-900">Home Settings</h1>
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
                Configure company branding and product card styles for customer storefronts.
              </p>
            </div>
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
              onClick={() => window.open("/preview?slug=home", "_blank", "noreferrer")}
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
      </header>

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
              icon={Server}
              label="CDN Configuration"
              description="Media delivery settings"
              active={activeSection === "cdn"}
              onClick={() => setActiveSection("cdn")}
            />
          </nav>
        </aside>

        <main className="flex-1 space-y-6">
          {activeSection === "branding" ? (
            <BrandingForm
              branding={branding}
              onChange={updateBranding}
              onUploadLogo={handleLogoUpload}
            onUploadFavicon={handleFaviconUpload}
            logoUpload={logoUploader.uploadState}
            faviconUpload={faviconUploader.uploadState}
          />
          ) : activeSection === "cdn" ? (
            <CDNForm
              cdnConfig={cdnConfig}
              onChange={updateCdnConfig}
            />
          ) : (
            <CardStyleForm
              cardStyle={cardStyle}
              cardVariant={cardVariant}
              onVariantChange={(variant) => {
                setCardVariant(variant);
                setDirty(true);
              }}
              onStyleChange={updateCardStyle}
            />
          )}
        </main>

        <aside className="w-full shrink-0 space-y-5 lg:w-[400px]">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Branding preview</h3>
                  <p className="text-xs text-slate-500">
                    See how your colours and logo appear together.
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-700">
                  <Upload className="h-4 w-4" />
                  <span className="sr-only">Upload logo</span>
                </Button>
              </div>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-slate-50">
                  {branding.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={branding.logo} alt="Company logo" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-xs font-semibold uppercase text-slate-400">Logo</span>
                  )}
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {branding.title || "Your company"}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Primary palette
                </span>
                <div className="flex items-center gap-3">
                  <span
                    className="h-10 w-10 rounded-full border border-slate-200"
                    style={{ backgroundColor: branding.primaryColor || "#009f7f" }}
                  />
                  <span
                    className="h-10 w-10 rounded-full border border-slate-200"
                    style={{ backgroundColor: branding.secondaryColor || "#02b290" }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{previewHeading}</h3>
                  <p className="text-xs text-slate-500">
                    Live preview updates as you tweak styles.
                  </p>
                </div>
                <div className="flex gap-2">
                  {CARD_VARIANTS.map((variant) => (
                    <button
                      key={variant.value}
                      type="button"
                      onClick={() => setPreviewVariant(variant.value)}
                      className={cn(
                        "rounded-lg border px-3 py-1 text-xs font-medium transition-colors",
                        previewVariant === variant.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {variant.label.split(" ")[0]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <ProductCardPreview
              variant={previewVariant}
              cardStyle={cardStyle}
              branding={branding}
              className="px-5 py-6"
            />
          </div>
        </aside>
      </div>
    </div>
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
    </SectionCard>
  );
}

function CDNForm({ cdnConfig, onChange }: CDNFormProps) {
  return (
    <SectionCard
      title="CDN Configuration"
      description="Configure content delivery network settings for product images and media."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <label htmlFor="cdn-enabled" className="flex items-center gap-2 text-sm font-medium text-slate-600">
            <input
              id="cdn-enabled"
              type="checkbox"
              checked={cdnConfig.enabled ?? true}
              onChange={(e) => onChange("enabled", e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/20"
            />
            Enable CDN
          </label>
          <p className="text-xs text-slate-500">
            When disabled, image paths will fall back to environment variable configuration.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-base-url" className="text-sm font-medium text-slate-600">
            CDN Base URL
          </label>
          <input
            id="cdn-base-url"
            type="url"
            value={cdnConfig.baseUrl || ""}
            onChange={(e) => onChange("baseUrl", e.target.value)}
            placeholder="https://s3.eu-de.cloud-object-storage.appdomain.cloud/eatit"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-mono focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            Base URL for serving product images and media files. Relative paths from the database will be prepended with this URL.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="cdn-description" className="text-sm font-medium text-slate-600">
            Description (optional)
          </label>
          <input
            id="cdn-description"
            type="text"
            value={cdnConfig.description || ""}
            onChange={(e) => onChange("description", e.target.value)}
            placeholder="IBM Cloud Object Storage - EU Region"
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <p className="text-xs text-slate-500">
            Admin reference note for this CDN configuration.
          </p>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">How it works</h4>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            <li>Product images store relative paths: <code className="bg-blue-100 px-1 py-0.5 rounded">/product_images/10076/main_image.jpg</code></li>
            <li>Full URLs are constructed at runtime: <code className="bg-blue-100 px-1 py-0.5 rounded">CDN_URL + relative_path</code></li>
            <li>Change CDN providers without updating database records</li>
            <li>Supports multiple CDN regions and environments</li>
          </ul>
        </div>
      </div>
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
