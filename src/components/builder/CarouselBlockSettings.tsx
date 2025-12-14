"use client";

import { useState, useEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CarouselBlockSettingsProps {
  blockId: string;
  config: any;
  onSave: (config: any) => void;
}

export function CarouselBlockSettings({ blockId, config, onSave }: CarouselBlockSettingsProps) {
  // Use ref to avoid onSave in useEffect dependency array (prevents infinite loop)
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const [apiEndpoint, setApiEndpoint] = useState(config.apiEndpoint || "");
  const [autoplay, setAutoplay] = useState(config.autoplay ?? false);
  const [loop, setLoop] = useState(config.loop ?? false);
  const [className, setClassName] = useState(config.className || "mb-12 xl:mb-14 pt-1");
  const [breakpoints, setBreakpoints] = useState(
    JSON.stringify(config.breakpoints || {}, null, 2)
  );
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const handlePreview = async () => {
    if (!apiEndpoint) return;

    setIsPreviewLoading(true);
    try {
      const response = await fetch(apiEndpoint);
      if (response.ok) {
        const data = await response.json();
        setPreviewData(data);
      } else {
        setPreviewData({ error: "Failed to load preview" });
      }
    } catch (error) {
      setPreviewData({ error: "Invalid API endpoint" });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Track if this is the initial mount to avoid triggering onSave on first render
  const isInitialMount = useRef(true);

  // Auto-sync settings to parent whenever they change
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    try {
      let parsedBreakpoints;
      try {
        parsedBreakpoints = JSON.parse(breakpoints);
      } catch {
        parsedBreakpoints = config.breakpoints || {};
      }

      onSaveRef.current({
        apiEndpoint,
        autoplay,
        loop,
        className,
        breakpoints: parsedBreakpoints
      });
    } catch (error) {
      console.error("Error syncing config:", error);
    }
  }, [apiEndpoint, autoplay, loop, className, breakpoints, config.breakpoints]);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="apiEndpoint">API Endpoint</Label>
        <Input
          id="apiEndpoint"
          type="text"
          value={apiEndpoint}
          onChange={(e) => setApiEndpoint(e.target.value)}
          placeholder="/api/cms/slider-top"
          className="mt-1"
        />
        <p className="mt-1 text-xs text-gray-500">
          API endpoint to fetch carousel data (e.g., /api/cms/slider-top or search query like /shop?text=makita)
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={handlePreview}
          disabled={!apiEndpoint || isPreviewLoading}
          variant="outline"
          size="sm"
        >
          {isPreviewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Preview Data
        </Button>
      </div>

      {previewData && (
        <div className="rounded-md border bg-gray-50 p-3">
          <p className="mb-2 text-sm font-medium">Preview Result:</p>
          <pre className="max-h-40 overflow-auto text-xs">
            {JSON.stringify(previewData, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex gap-4">
        <div className="flex items-center gap-2">
          <input
            id="autoplay"
            type="checkbox"
            checked={autoplay}
            onChange={(e) => setAutoplay(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="autoplay" className="cursor-pointer">
            Autoplay
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="loop"
            type="checkbox"
            checked={loop}
            onChange={(e) => setLoop(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="loop" className="cursor-pointer">
            Loop
          </Label>
        </div>
      </div>

      <div>
        <Label htmlFor="className">CSS Classes</Label>
        <Input
          id="className"
          type="text"
          value={className}
          onChange={(e) => setClassName(e.target.value)}
          placeholder="mb-12 xl:mb-14 pt-1"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="breakpoints">Breakpoints (JSON)</Label>
        <textarea
          id="breakpoints"
          value={breakpoints}
          onChange={(e) => setBreakpoints(e.target.value)}
          rows={10}
          className="mt-1 w-full rounded-md border border-gray-300 p-2 font-mono text-sm"
          placeholder={`{
  "1536": { "slidesPerView": 2, "spaceBetween": 20 },
  "1280": { "slidesPerView": 2, "spaceBetween": 16 },
  "0": { "slidesPerView": 1, "spaceBetween": 5 }
}`}
        />
        <p className="mt-1 text-xs text-gray-500">
          Configure responsive breakpoints for the carousel (Swiper format)
        </p>
      </div>

    </div>
  );
}
