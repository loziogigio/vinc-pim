"use client";

import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Link as LinkIcon, ExternalLink, Image as ImageIcon } from "lucide-react";

interface MediaImageConfig {
  imageUrl: string;
  alt?: string;
  linkUrl?: string;
  openInNewTab?: boolean;
  width?: string;
  maxWidth?: string;
  alignment?: "left" | "center" | "right";
}

interface MediaImageBlockSettingsProps {
  config: MediaImageConfig;
  onChange: (config: MediaImageConfig) => void;
}

export function MediaImageBlockSettings({ config, onChange }: MediaImageBlockSettingsProps) {
  const [localConfig, setLocalConfig] = useState<MediaImageConfig>(config);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Debounce changes
    const timeout = setTimeout(() => {
      onChange(localConfig);
    }, 300);
    return () => clearTimeout(timeout);
  }, [localConfig, onChange]);

  const updateField = <K extends keyof MediaImageConfig>(field: K, value: MediaImageConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setIsUploading(true);

    try {
      // Convert to base64 for now (you can replace this with actual CDN upload later)
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        updateField("imageUrl", base64String);
        setIsUploading(false);
      };
      reader.onerror = () => {
        alert("Failed to read image file");
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
      setIsUploading(false);
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
            disabled={isUploading}
            className="flex items-center gap-2 rounded-[0.428rem] border border-[#ebe9f1] bg-white px-4 py-2 text-[0.857rem] text-[#5e5873] transition hover:bg-[#fafafc] disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#009688] border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Image
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
          <div className="relative overflow-hidden rounded-lg border-2 border-[#ebe9f1] bg-slate-100">
            <img
              src={localConfig.imageUrl}
              alt={localConfig.alt || "Preview"}
              className="w-full h-auto max-h-80 object-contain"
              onError={(e) => {
                e.currentTarget.src = "";
                e.currentTarget.alt = "Failed to load image";
              }}
            />
          </div>
        </div>
      )}

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

      {/* Helper Info */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="mb-2 text-[0.857rem] font-medium text-blue-900">
          💡 Tips:
        </p>
        <ul className="space-y-1 text-[0.75rem] text-blue-800">
          <li>• Recommended: JPG or PNG format</li>
          <li>• Max file size: 5MB</li>
          <li>• For best quality, upload high-res images</li>
          <li>• Add alt text for better SEO</li>
        </ul>
      </div>
    </div>
  );
}
