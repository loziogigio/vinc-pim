"use client";

/* eslint-disable @next/next/no-img-element */
import type { MobileBlock, MobileAppIdentity } from "@/lib/types/mobile-builder";
import { MobileMediaSliderPreview } from "./blocks/MobileMediaSliderPreview";
import { MobileProductSliderPreview } from "./blocks/MobileProductSliderPreview";
import { MobileMediaGalleryPreview } from "./blocks/MobileMediaGalleryPreview";
import { MobileProductGalleryPreview } from "./blocks/MobileProductGalleryPreview";

interface MobilePreviewProps {
  blocks: MobileBlock[];
  appIdentity: MobileAppIdentity;
}

function renderBlock(block: MobileBlock) {
  switch (block.type) {
    case "mobile_media_slider":
      return <MobileMediaSliderPreview key={block.id} block={block} />;
    case "mobile_product_slider":
      return <MobileProductSliderPreview key={block.id} block={block} />;
    case "mobile_media_gallery":
      return <MobileMediaGalleryPreview key={block.id} block={block} />;
    case "mobile_product_gallery":
      return <MobileProductGalleryPreview key={block.id} block={block} />;
    default:
      return null;
  }
}

export function MobilePreview({ blocks, appIdentity }: MobilePreviewProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Phone frame */}
      <div className="relative">
        {/* Phone bezel */}
        <div className="relative rounded-[40px] bg-gray-900 p-3 shadow-xl">
          {/* Notch */}
          <div className="absolute left-1/2 top-0 h-7 w-32 -translate-x-1/2 rounded-b-2xl bg-gray-900" />

          {/* Screen */}
          <div className="relative h-[667px] w-[375px] overflow-hidden rounded-[32px] bg-white">
            {/* Status bar */}
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

            {/* Content area */}
            <div className="h-[calc(100%-44px-56px-34px)] overflow-y-auto bg-gray-50">
              {blocks.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="text-4xl">📱</div>
                  <p className="mt-4 text-sm text-gray-500">
                    Add blocks to see preview
                  </p>
                </div>
              ) : (
                <div className="space-y-0">
                  {blocks.map((block) => renderBlock(block))}
                </div>
              )}
            </div>

            {/* Home indicator */}
            <div className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full bg-gray-900" />
          </div>
        </div>
      </div>

      {/* Device label */}
      <div className="mt-4 text-sm text-gray-500">iPhone 14 (375 x 667)</div>
    </div>
  );
}
