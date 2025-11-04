"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload } from "lucide-react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { cn } from "@/components/ui/utils";
import { borderRadiusMap, computeMediaCardStyle, computeMediaHoverDeclarations } from '@/lib/home-settings/style-utils';

interface MediaImageStyle {
  borderWidth: number;
  borderColor: string;
  borderStyle: "solid" | "dashed" | "dotted" | "none";
  borderRadius: "none" | "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  shadowSize: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  shadowColor: string;
  backgroundColor: string;
  hoverEffect: "none" | "lift" | "shadow" | "scale" | "border" | "glow";
  hoverScale?: number;
  hoverShadowSize?: "sm" | "md" | "lg" | "xl" | "2xl";
  hoverBackgroundColor?: string;
}

interface MediaImageConfig {
  title?: string;
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
  openInNewTab?: boolean;
  width?: string;
  maxWidth?: string;
  alignment?: "left" | "center" | "right";
  style?: MediaImageStyle;
  className?: string;
}

interface MediaImageBlockSettingsProps {
  config: MediaImageConfig;
  onChange: (config: MediaImageConfig) => void;
}

export function MediaImageBlockSettings({ config, onChange }: MediaImageBlockSettingsProps) {
  const defaultStyle: MediaImageStyle = {
    borderWidth: 0,
    borderColor: "#EAEEF2",
    borderStyle: "solid",
    borderRadius: "md",
    shadowSize: "none",
    shadowColor: "rgba(0, 0, 0, 0.15)",
    backgroundColor: "#ffffff",
    hoverEffect: "none",
    hoverScale: 1.02,
    hoverShadowSize: "lg",
    hoverBackgroundColor: ""
  };

  const initialConfig: MediaImageConfig = {
    ...config,
    title: config.title || "",
    className: config.className || "mb-12 xl:mb-14 pt-1",
    style: {
      ...defaultStyle,
      ...(config.style || {})
    }
  };

  const [localConfig, setLocalConfig] = useState<MediaImageConfig>(initialConfig);
  const [showStyling, setShowStyling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadState, uploadImage, resetError } = useImageUpload();

  useEffect(() => {
    // Debounce changes
    const timeout = setTimeout(() => {
      onChange(localConfig);
    }, 300);
    return () => clearTimeout(timeout);
  }, [localConfig, onChange]);

  useEffect(() => {
    setLocalConfig({
      ...config,
      title: config.title || "",
      className: config.className || "mb-12 xl:mb-14 pt-1",
      style: {
        ...defaultStyle,
        ...(config.style || {})
      }
    });
  }, [config]);

  const updateField = <K extends keyof MediaImageConfig>(field: K, value: MediaImageConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const updateStyleField = <K extends keyof MediaImageStyle>(field: K, value: MediaImageStyle[K]) => {
    setLocalConfig(prev => {
      const nextStyle: MediaImageStyle = {
        ...defaultStyle,
        ...(prev.style || {}),
        [field]: value
      };

      if (field === "borderStyle" && value === "none") {
        nextStyle.borderWidth = 0;
      }

      if (field === "hoverEffect") {
        if (value === "shadow" || value === "glow") {
          nextStyle.hoverShadowSize = nextStyle.hoverShadowSize || "lg";
        } else {
          nextStyle.hoverShadowSize = undefined;
        }
      }

      return {
        ...prev,
        style: nextStyle
      };
    });
  };

  const styleOptions = useMemo<MediaImageStyle>(() => ({
    ...defaultStyle,
    ...(localConfig.style || {})
  }), [localConfig.style, defaultStyle]);

  const borderRadiusMap: Record<MediaImageStyle["borderRadius"], string> = {
    none: "0",
    sm: "0.125rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    full: "9999px"
  };

  const shadowMap: Record<Exclude<MediaImageStyle["shadowSize"], "none">, string> = {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
    "2xl": "0 25px 50px -12px rgb(0 0 0 / 0.25)"
  };

  const hoverShadowMap: Record<Exclude<MediaImageStyle["hoverShadowSize"], undefined>, string> = {
    sm: shadowMap.sm,
    md: shadowMap.md,
    lg: shadowMap.lg,
    xl: shadowMap.xl,
    "2xl": shadowMap["2xl"]
  };

  const previewCardStyle = useMemo(() => {
    const effectiveBorderWidth =
      styleOptions.borderStyle === "none" || styleOptions.borderWidth <= 0 ? 0 : styleOptions.borderWidth;

    return {
      borderWidth: `${effectiveBorderWidth}px`,
      borderStyle: styleOptions.borderStyle,
      borderColor: styleOptions.borderStyle === "none" ? "transparent" : styleOptions.borderColor,
      borderRadius: borderRadiusMap[styleOptions.borderRadius],
      backgroundColor: styleOptions.backgroundColor,
      boxShadow:
        styleOptions.shadowSize !== "none"
          ? shadowMap[styleOptions.shadowSize as Exclude<MediaImageStyle["shadowSize"], "none">]
          : "none",
      transition: "all 0.2s ease",
      overflow: "hidden"
    } as React.CSSProperties;
  }, [styleOptions, borderRadiusMap, shadowMap]);

  const previewHoverData = useMemo(() => {
    const declarations: string[] = [];

    switch (styleOptions.hoverEffect) {
      case "lift":
        declarations.push("transform: translateY(-4px);");
        break;
      case "shadow":
        declarations.push(`box-shadow: ${hoverShadowMap[styleOptions.hoverShadowSize || "lg"]};`);
        break;
      case "scale":
        declarations.push(`transform: scale(${styleOptions.hoverScale || 1.02});`);
        break;
      case "border":
        declarations.push(`border-color: ${styleOptions.borderColor};`);
        declarations.push("filter: brightness(0.95);");
        break;
      case "glow":
        declarations.push(`box-shadow: 0 0 25px ${styleOptions.shadowColor};`);
        break;
      default:
        break;
    }

    if (styleOptions.hoverBackgroundColor && styleOptions.hoverEffect !== "shadow") {
      declarations.push(`background-color: ${styleOptions.hoverBackgroundColor};`);
    }

    const css = declarations.length
      ? `.media-image-settings-preview:hover { ${declarations.join(" ")} }`
      : "";

    return css;
  }, [styleOptions, hoverShadowMap]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset any previous errors
    resetError();

    // Upload to CDN
    const cdnUrl = await uploadImage(file);

    if (cdnUrl) {
      // Update config with CDN URL
      updateField("imageUrl", cdnUrl);
    }

    // Clear file input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Upload Section */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[#5e5873]">
          Image *
        </Label>

        {/* Upload Button */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadState.isUploading}
            className="flex items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-2 text-[0.857rem] text-[#5e5873] transition hover:bg-[#fafafc] disabled:opacity-50"
          >
            {uploadState.isUploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
                Uploading... {uploadState.progress}%
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload to CDN
              </>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* Upload Error */}
        {uploadState.error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-[0.857rem] text-red-800">
            {uploadState.error}
          </div>
        )}

        {/* Or paste URL */}
        <div className="text-[0.75rem] text-[#b9b9c3] text-center py-1">or</div>
        <Input
          type="url"
          placeholder="Paste image URL"
          value={localConfig.imageUrl || ""}
          onChange={(e) => updateField("imageUrl", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Upload an image or paste a CDN URL
        </p>
      </div>

      {/* Image Preview */}
  {localConfig.imageUrl && (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-[#5e5873]">Preview</Label>
      {previewHoverData ? (
        <style dangerouslySetInnerHTML={{ __html: previewHoverData }} />
      ) : null}
      <div
        className={cn(
          "relative overflow-hidden bg-slate-100 transition-all duration-200",
          "media-image-settings-preview"
        )}
        style={previewCardStyle}
      >
        <img
          src={localConfig.imageUrl}
          alt={localConfig.alt || "Preview"}
          className="w-full h-auto max-h-80 object-contain"
          style={{ borderRadius: borderRadiusMap[styleOptions.borderRadius] }}
          onError={(e) => {
            e.currentTarget.src = "";
            e.currentTarget.alt = "Failed to load image";
          }}
        />
      </div>
    </div>
  )}

      {/* Section Title */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[#5e5873]">
          Section title (optional)
        </Label>
        <Input
          type="text"
          placeholder="e.g. Media spotlight"
          value={localConfig.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Display an optional heading above the image. Leave empty to hide it.
        </p>
      </div>

      {/* Container Tailwind classes */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-[#5e5873]">
          Container Tailwind classes
        </Label>
        <Input
          type="text"
          placeholder="mb-12 xl:mb-14 pt-1"
          value={localConfig.className || ""}
          onChange={(e) => updateField("className", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          These classes wrap the entire block (background, spacing, borders). Example:
          <code className="ml-1 rounded bg-[#f4f5fa] px-1 py-0.5 text-[0.7rem] text-[#5e5873]">
            bg-amber-50 border border-amber-200 rounded-2xl px-6 py-8
          </code>
        </p>
      </div>

      {/* Alt Text */}
      <div className="space-y-2">
        <Label htmlFor="media-alt" className="text-sm font-medium text-[#5e5873]">
          Alt Text
        </Label>
        <Input
          id="media-alt"
          type="text"
          placeholder="Describe the image for accessibility"
          value={localConfig.alt || ""}
          onChange={(e) => updateField("alt", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Important for SEO and accessibility
        </p>
      </div>

      {/* Link URL */}
      <div className="space-y-2">
        <Label htmlFor="media-link" className="text-sm font-medium text-[#5e5873]">
          Link URL (Optional)
        </Label>
        <Input
          id="media-link"
          type="url"
          placeholder="https://example.com"
          value={localConfig.linkUrl || ""}
          onChange={(e) => updateField("linkUrl", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Make the image clickable (leave empty for no link)
        </p>
      </div>

      {/* Open in New Tab Toggle */}
      {localConfig.linkUrl && (
        <div className="flex items-center justify-between rounded-lg border border-[#ebe9f1] bg-[#fafafc] p-4">
          <div>
            <Label htmlFor="media-newtab" className="text-sm font-medium text-[#5e5873]">
              Open in New Tab
            </Label>
            <p className="text-[0.75rem] text-[#b9b9c3]">
              Link opens in a new browser tab
            </p>
          </div>
          <label className="relative inline-flex cursor-pointer items-center">
            <input
              id="media-newtab"
              type="checkbox"
              checked={localConfig.openInNewTab ?? true}
              onChange={(e) => updateField("openInNewTab", e.target.checked)}
              className="peer sr-only"
            />
            <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#009688]/20"></div>
          </label>
        </div>
      )}

      {/* Alignment */}
      <div className="space-y-2">
        <Label htmlFor="media-alignment" className="text-sm font-medium text-[#5e5873]">
          Alignment
        </Label>
        <select
          id="media-alignment"
          value={localConfig.alignment || "center"}
          onChange={(e) => updateField("alignment", e.target.value as "left" | "center" | "right")}
          className="h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]"
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </div>

      {/* Size Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="media-width" className="text-sm font-medium text-[#5e5873]">
            Width
          </Label>
          <select
            id="media-width"
            value={localConfig.width || "100%"}
            onChange={(e) => updateField("width", e.target.value)}
            className="h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]"
          >
            <option value="100%">Full Width (100%)</option>
            <option value="75%">Large (75%)</option>
            <option value="50%">Medium (50%)</option>
            <option value="33%">Small (33%)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="media-maxwidth" className="text-sm font-medium text-[#5e5873]">
            Max Width
          </Label>
          <select
            id="media-maxwidth"
            value={localConfig.maxWidth || "800px"}
            onChange={(e) => updateField("maxWidth", e.target.value)}
            className="h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]"
          >
            <option value="400px">400px</option>
            <option value="600px">600px</option>
            <option value="800px">800px</option>
            <option value="1200px">1200px</option>
            <option value="none">No limit</option>
          </select>
        </div>
      </div>

      {/* Styling Options */}
      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white">
        <button
          type="button"
          onClick={() => setShowStyling((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-[0.857rem] font-semibold text-[#5e5873]"
        >
          <span>Styling options</span>
          <span className="text-xs text-[#b9b9c3]">{showStyling ? "Hide" : "Show"}</span>
        </button>
        {showStyling ? (
          <div className="space-y-4 border-t border-[#ebe9f1] px-4 py-4">
            <p className="text-[0.75rem] text-[#6f6b7b]">
              These controls affect the image card only. To change the yellow wrapper/background, use the
              Tailwind container classes above.
            </p>
            <div>
              <Label className="text-xs font-medium text-[#5e5873]">
                Border width: {localConfig.style?.borderWidth ?? 0}px
              </Label>
              <input
                type="range"
                min={0}
                max={8}
                value={localConfig.style?.borderWidth ?? 0}
                onChange={(event) => updateStyleField("borderWidth", Number(event.target.value))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Border color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={localConfig.style?.borderColor ?? "#EAEEF2"}
                    onChange={(event) => updateStyleField("borderColor", event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]"
                  />
                  <Input
                    value={localConfig.style?.borderColor ?? "#EAEEF2"}
                    onChange={(event) => updateStyleField("borderColor", event.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Background color</Label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={localConfig.style?.backgroundColor ?? "#ffffff"}
                    onChange={(event) => updateStyleField("backgroundColor", event.target.value)}
                    className="h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]"
                  />
                  <Input
                    value={localConfig.style?.backgroundColor ?? "#ffffff"}
                    onChange={(event) => updateStyleField("backgroundColor", event.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Border style</Label>
                <select
                  value={localConfig.style?.borderStyle ?? "solid"}
                  onChange={(event) =>
                    updateStyleField("borderStyle", event.target.value as MediaImageStyle["borderStyle"])
                  }
                  className="mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]"
                >
                  <option value="solid">Solid</option>
                  <option value="dashed">Dashed</option>
                  <option value="dotted">Dotted</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Corner roundness</Label>
                <select
                  value={localConfig.style?.borderRadius ?? "md"}
                  onChange={(event) =>
                    updateStyleField("borderRadius", event.target.value as MediaImageStyle["borderRadius"])
                  }
                  className="mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]"
                >
                  <option value="none">Square</option>
                  <option value="sm">Slightly rounded</option>
                  <option value="md">Moderately rounded</option>
                  <option value="lg">Very rounded</option>
                  <option value="xl">Extra rounded</option>
                  <option value="2xl">Super rounded</option>
                  <option value="full">Fully rounded</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Shadow size</Label>
                <select
                  value={localConfig.style?.shadowSize ?? "none"}
                  onChange={(event) =>
                    updateStyleField("shadowSize", event.target.value as MediaImageStyle["shadowSize"])
                  }
                  className="mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]"
                >
                  <option value="none">No shadow</option>
                  <option value="sm">Small shadow</option>
                  <option value="md">Medium shadow</option>
                  <option value="lg">Large shadow</option>
                  <option value="xl">Extra large</option>
                  <option value="2xl">Huge shadow</option>
                </select>
              </div>
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Shadow color</Label>
                <Input
                  value={localConfig.style?.shadowColor ?? "rgba(0, 0, 0, 0.15)"}
                  onChange={(event) => updateStyleField("shadowColor", event.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-[#5e5873]">Hover effect</Label>
              <select
                value={localConfig.style?.hoverEffect ?? "none"}
                onChange={(event) =>
                  updateStyleField("hoverEffect", event.target.value as MediaImageStyle["hoverEffect"])
                }
                className="h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]"
              >
                <option value="none">None</option>
                <option value="lift">Lift up</option>
                <option value="shadow">Add shadow</option>
                <option value="scale">Grow slightly</option>
                <option value="border">Highlight border</option>
                <option value="glow">Glow effect</option>
              </select>
            </div>

            {localConfig.style?.hoverEffect === "scale" ? (
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">
                  Hover scale: {(localConfig.style?.hoverScale ?? 1.02).toFixed(2)}×
                </Label>
                <input
                  type="range"
                  min={1}
                  max={1.1}
                  step={0.01}
                  value={localConfig.style?.hoverScale ?? 1.02}
                  onChange={(event) => updateStyleField("hoverScale", Number(event.target.value))}
                  className="w-full"
                />
              </div>
            ) : null}

            {["shadow", "glow"].includes(localConfig.style?.hoverEffect ?? "none") ? (
              <div>
                <Label className="text-xs font-medium text-[#5e5873]">Hover shadow size</Label>
                <select
                  value={localConfig.style?.hoverShadowSize ?? "lg"}
                  onChange={(event) =>
                    updateStyleField("hoverShadowSize", event.target.value as MediaImageStyle["hoverShadowSize"])
                  }
                  className="mt-1 h-9 w-full rounded border border-[#ebe9f1] bg-white px-3 text-xs text-[#5e5873]"
                >
                  <option value="sm">Small</option>
                  <option value="md">Medium</option>
                  <option value="lg">Large</option>
                  <option value="xl">Extra large</option>
                  <option value="2xl">Huge</option>
                </select>
              </div>
            ) : null}

            <div>
              <Label className="text-xs font-medium text-[#5e5873]">Hover background</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  type="color"
                  value={localConfig.style?.hoverBackgroundColor || "#ffffff"}
                  onChange={(event) => updateStyleField("hoverBackgroundColor", event.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-[#ebe9f1]"
                />
                <Input
                  value={localConfig.style?.hoverBackgroundColor || ""}
                  placeholder="Optional hex color"
                  onChange={(event) => updateStyleField("hoverBackgroundColor", event.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Helper Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="mb-2 text-[0.857rem] font-medium text-blue-900">
          💡 Tips:
        </p>
        <ul className="space-y-1 text-[0.75rem] text-blue-800">
          <li>• Recommended: JPG or PNG format</li>
          <li>• Max file size: 20MB</li>
          <li>• Images are uploaded to CDN for faster delivery</li>
          <li>• Add alt text for better SEO</li>
        </ul>
      </div>
    </div>
  );
}
