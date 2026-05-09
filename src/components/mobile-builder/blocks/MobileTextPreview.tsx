"use client";

import type { MobileTextBlock } from "@/lib/types/mobile-builder";

interface MobileTextPreviewProps {
  block: MobileTextBlock;
}

export function MobileTextPreview({ block }: MobileTextPreviewProps) {
  if (!block.content?.trim()) {
    return (
      <div className="px-4 py-3 text-sm italic text-gray-400">
        Empty text block — add editorial content in settings
      </div>
    );
  }
  return (
    <div
      className="prose prose-sm max-w-none px-4 py-3"
      dangerouslySetInnerHTML={{ __html: block.content }}
    />
  );
}
