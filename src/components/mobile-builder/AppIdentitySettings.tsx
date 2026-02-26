"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useRef } from "react";
import {
  Loader2,
  Upload,
  Trash2,
  Smartphone,
  Image as ImageIcon,
  Link as LinkIcon,
  Globe,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/components/ui/utils";
import type { MobileAppIdentity } from "@/lib/types/mobile-builder";

interface AppIdentitySettingsProps {
  appIdentity: MobileAppIdentity;
  onChange: (updates: Partial<MobileAppIdentity>) => void;
}

export function AppIdentitySettings({ appIdentity, onChange }: AppIdentitySettingsProps) {
  const [logoInputMode, setLogoInputMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/b2b/editor/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Upload failed");
      }

      const data = await response.json();
      onChange({ logo_url: data.url });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-center gap-2">
        <Smartphone className="h-4 w-4 text-slate-600" />
        <h3 className="text-sm font-semibold text-gray-700">App Identity</h3>
      </div>

      {/* App Name */}
      <div className="space-y-1.5">
        <Label className="text-xs">App Name</Label>
        <Input
          value={appIdentity.app_name}
          onChange={(e) => onChange({ app_name: e.target.value })}
          placeholder="My App"
          className="h-8 text-sm"
        />
      </div>

      {/* Logo */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Logo</Label>
          <div className="flex rounded-md border bg-white">
            <button
              type="button"
              onClick={() => setLogoInputMode("upload")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition",
                logoInputMode === "upload"
                  ? "bg-slate-100 text-slate-700"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Upload className="h-3 w-3" />
              Upload
            </button>
            <button
              type="button"
              onClick={() => setLogoInputMode("url")}
              className={cn(
                "flex items-center gap-1 px-2 py-1 text-xs transition",
                logoInputMode === "url"
                  ? "bg-slate-100 text-slate-700"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <LinkIcon className="h-3 w-3" />
              URL
            </button>
          </div>
        </div>

        {logoInputMode === "upload" ? (
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full gap-2"
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImageIcon className="h-4 w-4" />
              )}
              {isUploading ? "Uploading..." : "Choose Image"}
            </Button>
            {uploadError && (
              <p className="text-xs text-red-500">{uploadError}</p>
            )}
          </div>
        ) : (
          <Input
            value={appIdentity.logo_url}
            onChange={(e) => onChange({ logo_url: e.target.value })}
            placeholder="https://example.com/logo.png"
            className="h-8 text-sm"
          />
        )}

        {/* Logo Preview */}
        {appIdentity.logo_url && (
          <div className="flex items-center gap-2 rounded border bg-white p-2">
            <img
              src={appIdentity.logo_url}
              alt="Logo preview"
              className="h-10 w-auto object-contain"
            />
            <button
              type="button"
              onClick={() => onChange({ logo_url: "" })}
              className="ml-auto text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Logo Size */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Width (px)</Label>
          <Input
            type="number"
            value={appIdentity.logo_width}
            onChange={(e) => onChange({ logo_width: parseInt(e.target.value) || 64 })}
            min={20}
            max={200}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Height (px)</Label>
          <Input
            type="number"
            value={appIdentity.logo_height || ""}
            onChange={(e) => {
              const val = e.target.value;
              onChange({ logo_height: val ? parseInt(val) : undefined });
            }}
            placeholder="Auto"
            min={20}
            max={100}
            className="h-8 text-sm"
          />
        </div>
      </div>

      {/* Primary Color */}
      <div className="space-y-1.5">
        <Label className="text-xs">Primary Color (Buttons)</Label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={appIdentity.primary_color || "#ec4899"}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            className="h-8 w-12 cursor-pointer rounded border border-gray-300 p-0.5"
          />
          <Input
            value={appIdentity.primary_color || "#ec4899"}
            onChange={(e) => onChange({ primary_color: e.target.value })}
            placeholder="#ec4899"
            className="h-8 text-sm font-mono flex-1"
          />
        </div>
      </div>

      {/* Access Mode */}
      <div className="space-y-1.5">
        <Label className="text-xs">Access</Label>
        <div className="flex items-center justify-between rounded-md border bg-white px-3 py-2">
          <div className="flex items-center gap-2">
            {appIdentity.access_mode === "private" ? (
              <Lock className="h-4 w-4 text-amber-600" />
            ) : (
              <Globe className="h-4 w-4 text-green-600" />
            )}
            <span className="text-sm text-gray-700">
              {appIdentity.access_mode === "private" ? "Private" : "Public"}
            </span>
          </div>
          <Switch
            checked={appIdentity.access_mode === "private"}
            onCheckedChange={(checked) =>
              onChange({ access_mode: checked ? "private" : "public" })
            }
          />
        </div>
        <p className="text-[11px] text-gray-400">
          {appIdentity.access_mode === "private"
            ? "Users must log in to access the app"
            : "Anyone can browse the app without logging in"}
        </p>
      </div>
    </div>
  );
}
