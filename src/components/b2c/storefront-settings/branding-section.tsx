"use client";

import { useRef, useCallback, type ChangeEvent } from "react";
import { Upload, Loader2, Save } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { SectionCard } from "./section-card";
import { Field, ColorField, inputClass } from "./field-helpers";
import type { IB2CStorefrontBranding } from "./types";

export function BrandingSection({
  branding,
  onBrandingChange,
  saving,
  onSave,
}: {
  branding: IB2CStorefrontBranding;
  onBrandingChange: (b: IB2CStorefrontBranding) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const logoUploader = useImageUpload();
  const faviconUploader = useImageUpload();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof IB2CStorefrontBranding>(key: K, value: IB2CStorefrontBranding[K]) {
    onBrandingChange({ ...branding, [key]: value });
  }

  const handleLogoUpload = useCallback(
    async (file: File) => {
      logoUploader.resetError();
      const url = await logoUploader.uploadImage(file);
      if (url) onBrandingChange({ ...branding, logo_url: url });
    },
    [logoUploader, branding, onBrandingChange]
  );

  const handleFaviconUpload = useCallback(
    async (file: File) => {
      faviconUploader.resetError();
      const url = await faviconUploader.uploadImage(file);
      if (url) onBrandingChange({ ...branding, favicon_url: url });
    },
    [faviconUploader, branding, onBrandingChange]
  );

  const handleLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleLogoUpload(file);
    if (event.target) event.target.value = "";
  };

  const handleFaviconFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) await handleFaviconUpload(file);
    if (event.target) event.target.value = "";
  };

  return (
    <SectionCard title="Branding" description="Define how your storefront is presented visually.">
      <Field label="Company Title" helper="Appears in navigation, browser tab, and email templates.">
        <input
          type="text"
          value={branding.title || ""}
          onChange={(e) => update("title", e.target.value)}
          placeholder="My Store"
          className={inputClass}
        />
      </Field>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Logo */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">Logo</label>
              <p className="text-xs text-slate-500">Upload a square SVG/PNG. Max 20MB.</p>
            </div>
            {branding.logo_url && (
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => update("logo_url", "")}
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-slate-200 bg-gray-50">
              {branding.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo_url} alt="Logo" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs font-semibold uppercase text-slate-400">Logo</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={logoUploader.uploadState.isUploading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00796b] disabled:opacity-50"
              >
                {logoUploader.uploadState.isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {logoUploader.uploadState.isUploading ? "Uploading..." : "Upload logo"}
              </button>
              {logoUploader.uploadState.error && (
                <p className="text-xs text-red-500">{logoUploader.uploadState.error}</p>
              )}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFileChange} />
          <Field label="Logo URL" helper="SVG or PNG, ideally with transparent background.">
            <input
              type="text"
              value={branding.logo_url || ""}
              onChange={(e) => update("logo_url", e.target.value)}
              placeholder="https://example.com/logo.svg"
              className={inputClass}
            />
          </Field>
        </div>

        {/* Favicon */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-slate-700">Favicon</label>
              <p className="text-xs text-slate-500">Suggested 32x32 PNG/ICO.</p>
            </div>
            {branding.favicon_url && (
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-red-500"
                onClick={() => update("favicon_url", "")}
              >
                Remove
              </button>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-200 bg-gray-50">
              {branding.favicon_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.favicon_url} alt="Favicon" className="h-full w-full object-contain" />
              ) : (
                <span className="text-[10px] font-semibold uppercase text-slate-400">ICO</span>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => faviconInputRef.current?.click()}
                disabled={faviconUploader.uploadState.isUploading}
                className="inline-flex items-center gap-2 rounded-lg bg-[#009688] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#00796b] disabled:opacity-50"
              >
                {faviconUploader.uploadState.isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {faviconUploader.uploadState.isUploading ? "Uploading..." : "Upload favicon"}
              </button>
              {faviconUploader.uploadState.error && (
                <p className="text-xs text-red-500">{faviconUploader.uploadState.error}</p>
              )}
            </div>
          </div>
          <input ref={faviconInputRef} type="file" accept="image/*" className="hidden" onChange={handleFaviconFileChange} />
          <Field label="Favicon URL" helper="Square image (32x32 or 64x64) for browser tabs.">
            <input
              type="text"
              value={branding.favicon_url || ""}
              onChange={(e) => update("favicon_url", e.target.value)}
              placeholder="https://example.com/favicon.ico"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ColorField label="Primary Color" value={branding.primary_color || ""} onChange={(v) => update("primary_color", v)} helper="Buttons, highlights" />
        <ColorField label="Secondary Color" value={branding.secondary_color || ""} onChange={(v) => update("secondary_color", v)} helper="Accents, hover states" />
        <ColorField label="Accent Color" value={branding.accent_color || ""} onChange={(v) => update("accent_color", v)} helper="Badges, alerts" />
      </div>

      <Field label="Font Family" helper="e.g., Inter, Roboto, Open Sans">
        <input
          type="text"
          value={branding.font_family || ""}
          onChange={(e) => update("font_family", e.target.value)}
          placeholder="Inter"
          className={inputClass}
        />
      </Field>

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
