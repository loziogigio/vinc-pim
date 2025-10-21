"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Youtube } from "lucide-react";

interface YouTubeConfig {
  url: string;
  title?: string;
  autoplay?: boolean;
  width?: string;
  height?: string;
}

interface YouTubeBlockSettingsProps {
  config: YouTubeConfig;
  onChange: (config: YouTubeConfig) => void;
}

/**
 * Extract YouTube video ID from various URL formats
 */
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;

  // Handle youtube.com/watch?v=VIDEO_ID
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];

  // Handle youtu.be/VIDEO_ID
  const shortMatch = url.match(/youtu\.be\/([^?]+)/);
  if (shortMatch) return shortMatch[1];

  // Handle youtube.com/embed/VIDEO_ID
  const embedMatch = url.match(/embed\/([^?]+)/);
  if (embedMatch) return embedMatch[1];

  return null;
}

/**
 * Get YouTube thumbnail URL
 */
function getYouTubeThumbnail(videoId: string, quality: 'default' | 'hq' | 'maxres' = 'hq'): string {
  const qualityMap = {
    default: 'default.jpg',
    hq: 'hqdefault.jpg',
    maxres: 'maxresdefault.jpg'
  };
  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}`;
}

export function YouTubeBlockSettings({ config, onChange }: YouTubeBlockSettingsProps) {
  const [localConfig, setLocalConfig] = useState<YouTubeConfig>(config);
  const videoId = getYouTubeVideoId(localConfig.url);

  useEffect(() => {
    // Debounce changes
    const timeout = setTimeout(() => {
      onChange(localConfig);
    }, 300);
    return () => clearTimeout(timeout);
  }, [localConfig, onChange]);

  const updateField = (field: keyof YouTubeConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* YouTube URL Input */}
      <div className="space-y-2">
        <Label htmlFor="youtube-url" className="text-sm font-medium text-[#5e5873]">
          YouTube URL *
        </Label>
        <Input
          id="youtube-url"
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={localConfig.url || ""}
          onChange={(e) => updateField("url", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Paste any YouTube video URL (youtube.com/watch, youtu.be, or embed link)
        </p>
      </div>

      {/* Video Preview */}
      {videoId && (
        <div className="space-y-2">
          <Label className="text-sm font-medium text-[#5e5873]">Preview</Label>
          <div className="relative overflow-hidden rounded-lg border-2 border-[#ebe9f1] bg-black">
            <img
              src={getYouTubeThumbnail(videoId, 'hq')}
              alt="YouTube video thumbnail"
              className="w-full h-auto"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-700">
                <Youtube className="h-8 w-8 text-white" fill="white" />
              </div>
            </div>
          </div>
          <p className="text-[0.75rem] text-[#009688]">
            ✓ Valid YouTube video detected
          </p>
        </div>
      )}

      {/* Invalid URL Warning */}
      {localConfig.url && !videoId && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
          <p className="text-[0.857rem] text-yellow-800">
            ⚠️ Invalid YouTube URL. Please check the URL and try again.
          </p>
        </div>
      )}

      {/* Video Title */}
      <div className="space-y-2">
        <Label htmlFor="youtube-title" className="text-sm font-medium text-[#5e5873]">
          Video Title (Optional)
        </Label>
        <Input
          id="youtube-title"
          type="text"
          placeholder="e.g., Product Installation Guide"
          value={localConfig.title || ""}
          onChange={(e) => updateField("title", e.target.value)}
          className="h-10 rounded-[0.428rem] border-[#ebe9f1] text-[0.857rem]"
        />
        <p className="text-[0.75rem] text-[#b9b9c3]">
          Shown above the video on the product page
        </p>
      </div>

      {/* Autoplay Toggle */}
      <div className="flex items-center justify-between rounded-lg border border-[#ebe9f1] bg-[#fafafc] p-4">
        <div>
          <Label htmlFor="youtube-autoplay" className="text-sm font-medium text-[#5e5873]">
            Autoplay Video
          </Label>
          <p className="text-[0.75rem] text-[#b9b9c3]">
            Video starts playing automatically when page loads
          </p>
        </div>
        <label className="relative inline-flex cursor-pointer items-center">
          <input
            id="youtube-autoplay"
            type="checkbox"
            checked={localConfig.autoplay || false}
            onChange={(e) => updateField("autoplay", e.target.checked)}
            className="peer sr-only"
          />
          <div className="peer h-6 w-11 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-[#009688] peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#009688]/20"></div>
        </label>
      </div>

      {/* Size Settings */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="youtube-width" className="text-sm font-medium text-[#5e5873]">
            Width
          </Label>
          <select
            id="youtube-width"
            value={localConfig.width || "100%"}
            onChange={(e) => updateField("width", e.target.value)}
            className="h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]"
          >
            <option value="100%">Full Width (100%)</option>
            <option value="75%">Large (75%)</option>
            <option value="50%">Medium (50%)</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="youtube-height" className="text-sm font-medium text-[#5e5873]">
            Height
          </Label>
          <select
            id="youtube-height"
            value={localConfig.height || "450px"}
            onChange={(e) => updateField("height", e.target.value)}
            className="h-10 w-full rounded-[0.428rem] border border-[#ebe9f1] bg-white px-3 text-[0.857rem] text-[#5e5873]"
          >
            <option value="300px">Small (300px)</option>
            <option value="450px">Medium (450px)</option>
            <option value="600px">Large (600px)</option>
            <option value="responsive">Responsive (16:9)</option>
          </select>
        </div>
      </div>

      {/* Example URLs Helper */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="mb-2 text-[0.857rem] font-medium text-blue-900">
          📌 Example YouTube URLs:
        </p>
        <ul className="space-y-1 text-[0.75rem] text-blue-800">
          <li>• youtube.com/watch?v=VIDEO_ID</li>
          <li>• youtu.be/VIDEO_ID</li>
          <li>• youtube.com/embed/VIDEO_ID</li>
        </ul>
      </div>
    </div>
  );
}
