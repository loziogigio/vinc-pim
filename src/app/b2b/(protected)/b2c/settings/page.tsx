"use client";

import { Settings } from "lucide-react";

export default function B2CSettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[#5e5873]">B2C Settings</h1>
        <p className="text-sm text-[#b9b9c3]">
          Global settings for all B2C storefronts
        </p>
      </div>

      <div className="rounded-lg border border-[#ebe9f1] bg-white p-8 text-center max-w-2xl">
        <Settings className="mx-auto h-12 w-12 text-[#b9b9c3] mb-4" />
        <h2 className="text-lg font-medium text-[#5e5873] mb-2">
          Coming Soon
        </h2>
        <p className="text-sm text-[#b9b9c3]">
          Global B2C settings (default branding, CDN configuration, shared
          templates) will be available here. For now, configure each storefront
          individually from the Storefronts section.
        </p>
      </div>
    </div>
  );
}
