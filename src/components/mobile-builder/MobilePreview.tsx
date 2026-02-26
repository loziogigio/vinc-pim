"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MobileBlock, MobileAppIdentity } from "@/lib/types/mobile-builder";
import { MobileMediaSliderPreview } from "./blocks/MobileMediaSliderPreview";
import { MobileProductSliderPreview } from "./blocks/MobileProductSliderPreview";
import { MobileMediaGalleryPreview } from "./blocks/MobileMediaGalleryPreview";
import { MobileProductGalleryPreview } from "./blocks/MobileProductGalleryPreview";
import { MobileCategorySliderPreview } from "./blocks/MobileCategorySliderPreview";
import { MobileCategoryGalleryPreview } from "./blocks/MobileCategoryGalleryPreview";
import { MobileEntitySliderPreview } from "./blocks/MobileEntitySliderPreview";
import { MobileEntityGalleryPreview } from "./blocks/MobileEntityGalleryPreview";
import { cn } from "@/components/ui/utils";

// Device configurations
interface DeviceConfig {
  id: string;
  name: string;
  brand: "apple" | "android";
  width: number;
  height: number;
  frameStyle: "notch" | "dynamic-island" | "punch-hole" | "waterdrop";
}

const DEVICES: DeviceConfig[] = [
  // Apple devices
  { id: "iphone-14", name: "iPhone 14", brand: "apple", width: 390, height: 844, frameStyle: "notch" },
  { id: "iphone-14-pro", name: "iPhone 14 Pro", brand: "apple", width: 393, height: 852, frameStyle: "dynamic-island" },
  { id: "iphone-se", name: "iPhone SE", brand: "apple", width: 375, height: 667, frameStyle: "notch" },
  // Android devices
  { id: "pixel-8", name: "Google Pixel 8", brand: "android", width: 412, height: 915, frameStyle: "punch-hole" },
  { id: "pixel-7a", name: "Google Pixel 7a", brand: "android", width: 412, height: 892, frameStyle: "punch-hole" },
  { id: "galaxy-s24", name: "Samsung Galaxy S24", brand: "android", width: 412, height: 915, frameStyle: "punch-hole" },
  { id: "galaxy-a54", name: "Samsung Galaxy A54", brand: "android", width: 412, height: 915, frameStyle: "waterdrop" },
];

// Scale factor to fit preview in viewport
const SCALE_FACTOR = 0.75;

interface MobilePreviewProps {
  blocks: MobileBlock[];
  appIdentity: MobileAppIdentity;
}

function renderBlock(block: MobileBlock, primaryColor: string) {
  switch (block.type) {
    case "mobile_media_slider":
      return <MobileMediaSliderPreview key={block.id} block={block} />;
    case "mobile_product_slider":
      return <MobileProductSliderPreview key={block.id} block={block} primaryColor={primaryColor} />;
    case "mobile_media_gallery":
      return <MobileMediaGalleryPreview key={block.id} block={block} />;
    case "mobile_product_gallery":
      return <MobileProductGalleryPreview key={block.id} block={block} primaryColor={primaryColor} />;
    case "mobile_category_slider":
      return <MobileCategorySliderPreview key={block.id} block={block} primaryColor={primaryColor} />;
    case "mobile_category_gallery":
      return <MobileCategoryGalleryPreview key={block.id} block={block} primaryColor={primaryColor} />;
    case "mobile_entity_slider":
      return <MobileEntitySliderPreview key={block.id} block={block} primaryColor={primaryColor} />;
    case "mobile_entity_gallery":
      return <MobileEntityGalleryPreview key={block.id} block={block} primaryColor={primaryColor} />;
    default:
      return null;
  }
}

// iOS Status Bar
function IOSStatusBar() {
  return (
    <div className="flex h-11 items-center justify-between bg-white px-6">
      <span className="text-sm font-semibold">9:41</span>
      <div className="flex items-center gap-1">
        <div className="flex gap-0.5">
          <div className="h-2.5 w-0.5 rounded-full bg-gray-900" />
          <div className="h-3 w-0.5 rounded-full bg-gray-900" />
          <div className="h-3.5 w-0.5 rounded-full bg-gray-900" />
          <div className="h-4 w-0.5 rounded-full bg-gray-900" />
        </div>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
        </svg>
        <div className="flex h-4 w-6 items-center rounded-sm border border-gray-900">
          <div className="ml-0.5 h-2.5 w-4 rounded-sm bg-gray-900" />
        </div>
      </div>
    </div>
  );
}

// Android Status Bar
function AndroidStatusBar() {
  return (
    <div className="flex h-6 items-center justify-between bg-white px-4">
      <span className="text-xs font-medium">12:00</span>
      <div className="flex items-center gap-1.5">
        {/* WiFi */}
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 00-6 0zm-4-4l2 2a7.074 7.074 0 0110 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
        </svg>
        {/* Signal bars */}
        <div className="flex items-end gap-0.5">
          <div className="h-1.5 w-1 rounded-sm bg-gray-900" />
          <div className="h-2 w-1 rounded-sm bg-gray-900" />
          <div className="h-2.5 w-1 rounded-sm bg-gray-900" />
          <div className="h-3 w-1 rounded-sm bg-gray-900" />
        </div>
        {/* Battery */}
        <div className="flex h-3 w-5 items-center rounded-sm border border-gray-900">
          <div className="ml-0.5 h-1.5 w-3 rounded-sm bg-gray-900" />
        </div>
      </div>
    </div>
  );
}

export function MobilePreview({ blocks, appIdentity }: MobilePreviewProps) {
  const [selectedDeviceId, setSelectedDeviceId] = useState("iphone-14");
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const device = DEVICES.find((d) => d.id === selectedDeviceId) || DEVICES[0];
  const isApple = device.brand === "apple";

  // Scaled dimensions
  const scaledWidth = device.width * SCALE_FACTOR;
  const scaledHeight = device.height * SCALE_FACTOR;

  return (
    <div className="flex flex-col items-center">
      {/* Device selector - at top */}
      <div className="relative mb-4">
        <button
          type="button"
          onClick={() => setShowDeviceDropdown(!showDeviceDropdown)}
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
        >
          {isApple ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.523 2H6.477C5.667 2 5 2.667 5 3.477v17.046c0 .81.667 1.477 1.477 1.477h11.046c.81 0 1.477-.667 1.477-1.477V3.477C19 2.667 18.333 2 17.523 2zM12 21.5c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm5-3.5H7V4h10v14z"/>
            </svg>
          )}
          <span>{device.name}</span>
          <span className="text-gray-400">({device.width} × {device.height})</span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>

        {showDeviceDropdown && (
          <div className="absolute left-1/2 top-full z-50 mt-2 w-72 -translate-x-1/2 rounded-lg border bg-white py-2 shadow-lg">
            {/* Apple devices */}
            <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Apple</div>
            {DEVICES.filter((d) => d.brand === "apple").map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setSelectedDeviceId(d.id);
                  setShowDeviceDropdown(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50",
                  d.id === selectedDeviceId && "bg-slate-50 text-slate-600"
                )}
              >
                <span>{d.name}</span>
                <span className="text-xs text-gray-400">{d.width} × {d.height}</span>
              </button>
            ))}

            {/* Android devices */}
            <div className="mt-2 border-t px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">Android</div>
            {DEVICES.filter((d) => d.brand === "android").map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setSelectedDeviceId(d.id);
                  setShowDeviceDropdown(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50",
                  d.id === selectedDeviceId && "bg-slate-50 text-slate-600"
                )}
              >
                <span>{d.name}</span>
                <span className="text-xs text-gray-400">{d.width} × {d.height}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone frame */}
      <div className="relative" style={{ transform: `scale(${SCALE_FACTOR})`, transformOrigin: "top center" }}>
        {/* Phone bezel */}
        <div className={cn(
          "relative bg-gray-900 p-3 shadow-xl",
          isApple ? "rounded-[40px]" : "rounded-[32px]"
        )}>
          {/* Frame details based on device type */}
          {device.frameStyle === "notch" && (
            <div className="absolute left-1/2 top-0 h-7 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900 z-10" />
          )}
          {device.frameStyle === "dynamic-island" && (
            <div className="absolute left-1/2 top-4 h-8 w-28 -translate-x-1/2 rounded-full bg-gray-900 z-10" />
          )}
          {device.frameStyle === "punch-hole" && (
            <div className="absolute left-1/2 top-4 h-3 w-3 -translate-x-1/2 rounded-full bg-gray-900 z-10" />
          )}
          {device.frameStyle === "waterdrop" && (
            <div className="absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2 rounded-b-full bg-gray-900 z-10" />
          )}

          {/* Screen */}
          <div
            className={cn(
              "relative overflow-hidden bg-white",
              isApple ? "rounded-[32px]" : "rounded-[24px]"
            )}
            style={{ width: device.width, height: device.height }}
          >
            {/* Status bar */}
            {isApple ? <IOSStatusBar /> : <AndroidStatusBar />}

            {/* App Header - Logo + Search */}
            <div className="flex h-14 items-center gap-3 bg-white px-4 border-b border-gray-100">
              {/* Logo from App Identity */}
              <div className="flex-shrink-0 flex items-center">
                {appIdentity.logo_url ? (
                  <img
                    src={appIdentity.logo_url}
                    alt={appIdentity.app_name || "Logo"}
                    style={{
                      width: appIdentity.logo_width,
                      height: appIdentity.logo_height ?? "auto",
                    }}
                    className="object-contain"
                  />
                ) : (
                  <div
                    className="flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400"
                    style={{
                      width: appIdentity.logo_width,
                      height: appIdentity.logo_height ?? 40,
                    }}
                  >
                    {appIdentity.app_name || "Logo"}
                  </div>
                )}
              </div>
              {/* Search bar */}
              <div className="flex-1">
                <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2">
                  <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="text-sm text-gray-400">Cerca prodotto...</span>
                </div>
              </div>
            </div>

            {/* Content area - adjust height based on status bar */}
            <div
              className="overflow-y-auto bg-gray-50"
              style={{ height: `calc(100% - ${isApple ? "44px" : "24px"} - 56px - 34px)` }}
            >
              {blocks.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-4xl">📱</div>
                  <p className="mt-4 text-sm text-gray-500">
                    Add blocks to see preview
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {blocks.map((block) => renderBlock(block, appIdentity.primary_color || "#ec4899"))}
                </div>
              )}
            </div>

            {/* Home indicator (iOS) or Navigation bar (Android) */}
            {isApple ? (
              <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-gray-900" />
            ) : (
              <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-8">
                <div className="h-4 w-4 border-2 border-gray-400 rounded-sm" />
                <div className="h-4 w-4 rounded-full border-2 border-gray-400" />
                <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-b-[12px] border-l-transparent border-r-transparent border-b-gray-400" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
