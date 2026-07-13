"use client";

import { Save, Loader2 } from "lucide-react";
import { SectionCard } from "./section-card";
import type { IB2CStorefrontMetaTags } from "./types";
import type { IB2BPortalSeoConfig } from "@/lib/types/b2b-portal";

const inputClass =
  "w-full rounded-lg border border-border px-4 py-2.5 text-sm text-foreground bg-background focus:border-primary focus:ring-1 focus:ring-primary";

export function SeoSection({
  metaTags,
  onChange,
  channelSeo,
  onChannelSeoChange,
  languages = [],
  saving,
  onSave,
}: {
  metaTags: IB2CStorefrontMetaTags;
  onChange: (key: keyof IB2CStorefrontMetaTags, value: string) => void;
  /** B2B-only URL/robots settings. Omit the change callback on B2C screens. */
  channelSeo?: IB2BPortalSeoConfig;
  onChannelSeoChange?: (value: IB2BPortalSeoConfig) => void;
  languages?: Array<{ code: string; name: string; nativeName?: string }>;
  saving: boolean;
  onSave: () => void;
}) {
  const updateCategoryRoot = (locale: string, value: string) => {
    if (!onChannelSeoChange) return;
    onChannelSeoChange({
      ...channelSeo,
      category_root: {
        ...(channelSeo?.category_root || {}),
        [locale]: value,
      },
    });
  };

  const updateRobots = (
    patch: Partial<NonNullable<IB2BPortalSeoConfig["robots"]>>,
  ) => {
    if (!onChannelSeoChange) return;
    onChannelSeoChange({
      ...channelSeo,
      robots: { ...(channelSeo?.robots || {}), ...patch },
    });
  };

  const toLines = (values: string[] | undefined) => (values || []).join("\n");
  const fromLines = (value: string) =>
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

  return (
    <div className="space-y-6">
      {onChannelSeoChange && (
        <SectionCard
          title="B2B Channel SEO & Routing"
          description="Canonical category paths and robots rules used by the B2B storefront, product pages, and sitemap."
        >
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <label className="text-sm font-medium text-foreground">
                  Default category URL segment
                </label>
                <input
                  type="text"
                  value={channelSeo?.category_root?.default || ""}
                  onChange={(event) =>
                    updateCategoryRoot("default", event.target.value)
                  }
                  placeholder="categorie"
                  className={inputClass}
                />
                <p className="text-xs text-muted-foreground">
                  One URL segment only, without slashes (for example: categorie or catalogo).
                </p>
              </div>

              {languages.map((language) => (
                <div key={language.code} className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {language.nativeName || language.name} ({language.code}) override
                  </label>
                  <input
                    type="text"
                    value={channelSeo?.category_root?.[language.code] || ""}
                    onChange={(event) =>
                      updateCategoryRoot(language.code, event.target.value)
                    }
                    placeholder={channelSeo?.category_root?.default || "categorie"}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-border pt-5 space-y-4">
              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <input
                  type="checkbox"
                  checked={channelSeo?.robots?.noindex === true}
                  onChange={(event) => updateRobots({ noindex: event.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    Prevent search-engine indexing
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Emits Disallow: / for the entire B2B channel. Use this for staging or private portals.
                  </span>
                </span>
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Robots allow paths
                  </label>
                  <textarea
                    value={toLines(channelSeo?.robots?.allow)}
                    onChange={(event) =>
                      updateRobots({ allow: fromLines(event.target.value) })
                    }
                    rows={6}
                    placeholder="/"
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <p className="text-xs text-muted-foreground">One path per line.</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Robots disallow paths
                  </label>
                  <textarea
                    value={toLines(channelSeo?.robots?.disallow)}
                    onChange={(event) =>
                      updateRobots({ disallow: fromLines(event.target.value) })
                    }
                    rows={6}
                    placeholder={"/api/\n/account/\n/checkout/"}
                    className={`${inputClass} font-mono text-xs`}
                  />
                  <p className="text-xs text-muted-foreground">One path per line.</p>
                </div>
              </div>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Basic SEO */}
      <SectionCard title="Basic SEO" description="Essential meta tags for search engines">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Page Title</label>
            <input type="text" value={metaTags.title || ""} onChange={(e) => onChange("title", e.target.value)} placeholder="Your Store - Welcome" className={inputClass} />
            <p className="text-xs text-muted-foreground">Appears in browser tab and search results (50-60 characters recommended)</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">Meta Description</label>
            <textarea value={metaTags.description || ""} onChange={(e) => onChange("description", e.target.value)} placeholder="A brief description of your store for search results..." rows={3} className={inputClass} />
            <p className="text-xs text-muted-foreground">Description shown in search results (150-160 characters recommended)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Keywords</label>
            <input type="text" value={metaTags.keywords || ""} onChange={(e) => onChange("keywords", e.target.value)} placeholder="shop, products, brand" className={inputClass} />
            <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Author</label>
            <input type="text" value={metaTags.author || ""} onChange={(e) => onChange("author", e.target.value)} placeholder="Company Name" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Robots Directive</label>
            <select value={metaTags.robots || "index, follow"} onChange={(e) => onChange("robots", e.target.value)} className={inputClass}>
              <option value="index, follow">Index, Follow (default)</option>
              <option value="noindex, follow">No Index, Follow</option>
              <option value="index, nofollow">Index, No Follow</option>
              <option value="noindex, nofollow">No Index, No Follow</option>
            </select>
            <p className="text-xs text-muted-foreground">Controls how search engines crawl and index the site</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Canonical URL</label>
            <input type="url" value={metaTags.canonical_url || ""} onChange={(e) => onChange("canonical_url", e.target.value)} placeholder="https://shop.example.com" className={inputClass} />
            <p className="text-xs text-muted-foreground">Preferred URL for the homepage</p>
          </div>
        </div>
      </SectionCard>

      {/* Open Graph */}
      <SectionCard title="Open Graph (Social Sharing)" description="How your site appears when shared on Facebook, LinkedIn, etc.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">OG Title</label>
            <input type="text" value={metaTags.og_title || ""} onChange={(e) => onChange("og_title", e.target.value)} placeholder="Leave empty to use page title" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Site Name</label>
            <input type="text" value={metaTags.og_site_name || ""} onChange={(e) => onChange("og_site_name", e.target.value)} placeholder="Your Company" className={inputClass} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">OG Description</label>
            <textarea value={metaTags.og_description || ""} onChange={(e) => onChange("og_description", e.target.value)} placeholder="Leave empty to use meta description" rows={2} className={inputClass} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-foreground">OG Image URL</label>
            <input type="url" value={metaTags.og_image || ""} onChange={(e) => onChange("og_image", e.target.value)} placeholder="https://cdn.example.com/og-image.jpg" className={inputClass} />
            <p className="text-xs text-muted-foreground">Recommended size: 1200x630 pixels (JPG or PNG)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">OG Type</label>
            <select value={metaTags.og_type || "website"} onChange={(e) => onChange("og_type", e.target.value)} className={inputClass}>
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
            <label className="text-sm font-medium text-foreground">Card Type</label>
            <select value={metaTags.twitter_card || "summary_large_image"} onChange={(e) => onChange("twitter_card", e.target.value)} className={inputClass}>
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
              <option value="app">App</option>
              <option value="player">Player</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Site @username</label>
            <input type="text" value={metaTags.twitter_site || ""} onChange={(e) => onChange("twitter_site", e.target.value)} placeholder="@yourcompany" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Creator @username</label>
            <input type="text" value={metaTags.twitter_creator || ""} onChange={(e) => onChange("twitter_creator", e.target.value)} placeholder="@creator" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Twitter Image URL</label>
            <input type="url" value={metaTags.twitter_image || ""} onChange={(e) => onChange("twitter_image", e.target.value)} placeholder="Leave empty to use OG image" className={inputClass} />
          </div>
        </div>
      </SectionCard>

      {/* Additional Settings */}
      <SectionCard title="Additional Settings" description="Theme color and site verification">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Theme Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={metaTags.theme_color || "#009688"} onChange={(e) => onChange("theme_color", e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-border bg-background" />
              <input type="text" value={metaTags.theme_color || ""} onChange={(e) => onChange("theme_color", e.target.value)} placeholder="#009688" className={`flex-1 ${inputClass}`} />
            </div>
            <p className="text-xs text-muted-foreground">Browser address bar color on mobile</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Google Site Verification</label>
            <input type="text" value={metaTags.google_site_verification || ""} onChange={(e) => onChange("google_site_verification", e.target.value)} placeholder="Verification code from Google Search Console" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Bing Site Verification</label>
            <input type="text" value={metaTags.bing_site_verification || ""} onChange={(e) => onChange("bing_site_verification", e.target.value)} placeholder="Verification code from Bing Webmaster Tools" className={inputClass} />
          </div>
        </div>
      </SectionCard>

      {/* Structured Data */}
      <SectionCard title="Structured Data (JSON-LD)" description="Advanced: Custom structured data for rich snippets">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">JSON-LD Structured Data</label>
          <textarea
            value={metaTags.structured_data || ""}
            onChange={(e) => onChange("structured_data", e.target.value)}
            placeholder={`{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your Company",
  "url": "https://shop.example.com"
}`}
            rows={10}
            className={`${inputClass} font-mono`}
          />
          <p className="text-xs text-muted-foreground">Optional JSON-LD for Organization, LocalBusiness, or other schema types</p>
        </div>
      </SectionCard>

      {/* Save */}
      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save SEO Settings"}
        </button>
      </div>
    </div>
  );
}
