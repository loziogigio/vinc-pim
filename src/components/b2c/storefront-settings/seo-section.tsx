"use client";

import { Save, Loader2 } from "lucide-react";
import { SectionCard } from "./section-card";
import type { IB2CStorefrontMetaTags } from "./types";

const inputClass =
  "w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-900 focus:border-[#009688] focus:ring-1 focus:ring-[#009688]";

export function SeoSection({
  metaTags,
  onChange,
  saving,
  onSave,
}: {
  metaTags: IB2CStorefrontMetaTags;
  onChange: (key: keyof IB2CStorefrontMetaTags, value: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Basic SEO */}
      <SectionCard title="Basic SEO" description="Essential meta tags for search engines">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-600">Page Title</label>
            <input type="text" value={metaTags.title || ""} onChange={(e) => onChange("title", e.target.value)} placeholder="Your Store - Welcome" className={inputClass} />
            <p className="text-xs text-slate-500">Appears in browser tab and search results (50-60 characters recommended)</p>
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-600">Meta Description</label>
            <textarea value={metaTags.description || ""} onChange={(e) => onChange("description", e.target.value)} placeholder="A brief description of your store for search results..." rows={3} className={inputClass} />
            <p className="text-xs text-slate-500">Description shown in search results (150-160 characters recommended)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Keywords</label>
            <input type="text" value={metaTags.keywords || ""} onChange={(e) => onChange("keywords", e.target.value)} placeholder="shop, products, brand" className={inputClass} />
            <p className="text-xs text-slate-500">Comma-separated keywords</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Author</label>
            <input type="text" value={metaTags.author || ""} onChange={(e) => onChange("author", e.target.value)} placeholder="Company Name" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Robots Directive</label>
            <select value={metaTags.robots || "index, follow"} onChange={(e) => onChange("robots", e.target.value)} className={inputClass}>
              <option value="index, follow">Index, Follow (default)</option>
              <option value="noindex, follow">No Index, Follow</option>
              <option value="index, nofollow">Index, No Follow</option>
              <option value="noindex, nofollow">No Index, No Follow</option>
            </select>
            <p className="text-xs text-slate-500">Controls how search engines crawl and index the site</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Canonical URL</label>
            <input type="url" value={metaTags.canonical_url || ""} onChange={(e) => onChange("canonical_url", e.target.value)} placeholder="https://shop.example.com" className={inputClass} />
            <p className="text-xs text-slate-500">Preferred URL for the homepage</p>
          </div>
        </div>
      </SectionCard>

      {/* Open Graph */}
      <SectionCard title="Open Graph (Social Sharing)" description="How your site appears when shared on Facebook, LinkedIn, etc.">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">OG Title</label>
            <input type="text" value={metaTags.og_title || ""} onChange={(e) => onChange("og_title", e.target.value)} placeholder="Leave empty to use page title" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Site Name</label>
            <input type="text" value={metaTags.og_site_name || ""} onChange={(e) => onChange("og_site_name", e.target.value)} placeholder="Your Company" className={inputClass} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-600">OG Description</label>
            <textarea value={metaTags.og_description || ""} onChange={(e) => onChange("og_description", e.target.value)} placeholder="Leave empty to use meta description" rows={2} className={inputClass} />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-slate-600">OG Image URL</label>
            <input type="url" value={metaTags.og_image || ""} onChange={(e) => onChange("og_image", e.target.value)} placeholder="https://cdn.example.com/og-image.jpg" className={inputClass} />
            <p className="text-xs text-slate-500">Recommended size: 1200x630 pixels (JPG or PNG)</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">OG Type</label>
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
            <label className="text-sm font-medium text-slate-600">Card Type</label>
            <select value={metaTags.twitter_card || "summary_large_image"} onChange={(e) => onChange("twitter_card", e.target.value)} className={inputClass}>
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary Large Image</option>
              <option value="app">App</option>
              <option value="player">Player</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Site @username</label>
            <input type="text" value={metaTags.twitter_site || ""} onChange={(e) => onChange("twitter_site", e.target.value)} placeholder="@yourcompany" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Creator @username</label>
            <input type="text" value={metaTags.twitter_creator || ""} onChange={(e) => onChange("twitter_creator", e.target.value)} placeholder="@creator" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Twitter Image URL</label>
            <input type="url" value={metaTags.twitter_image || ""} onChange={(e) => onChange("twitter_image", e.target.value)} placeholder="Leave empty to use OG image" className={inputClass} />
          </div>
        </div>
      </SectionCard>

      {/* Additional Settings */}
      <SectionCard title="Additional Settings" description="Theme color and site verification">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Theme Color</label>
            <div className="flex items-center gap-3">
              <input type="color" value={metaTags.theme_color || "#009688"} onChange={(e) => onChange("theme_color", e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-300" />
              <input type="text" value={metaTags.theme_color || ""} onChange={(e) => onChange("theme_color", e.target.value)} placeholder="#009688" className={`flex-1 ${inputClass}`} />
            </div>
            <p className="text-xs text-slate-500">Browser address bar color on mobile</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Google Site Verification</label>
            <input type="text" value={metaTags.google_site_verification || ""} onChange={(e) => onChange("google_site_verification", e.target.value)} placeholder="Verification code from Google Search Console" className={inputClass} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600">Bing Site Verification</label>
            <input type="text" value={metaTags.bing_site_verification || ""} onChange={(e) => onChange("bing_site_verification", e.target.value)} placeholder="Verification code from Bing Webmaster Tools" className={inputClass} />
          </div>
        </div>
      </SectionCard>

      {/* Structured Data */}
      <SectionCard title="Structured Data (JSON-LD)" description="Advanced: Custom structured data for rich snippets">
        <div className="space-y-2">
          <label className="text-sm font-medium text-slate-600">JSON-LD Structured Data</label>
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
          <p className="text-xs text-slate-500">Optional JSON-LD for Organization, LocalBusiness, or other schema types</p>
        </div>
      </SectionCard>

      {/* Save */}
      <div className="pt-2">
        <button
          onClick={onSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-5 py-2 text-sm font-medium text-white hover:bg-[#00796b] disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save SEO Settings"}
        </button>
      </div>
    </div>
  );
}
