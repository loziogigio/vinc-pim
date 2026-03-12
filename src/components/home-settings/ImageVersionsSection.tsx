"use client";

import { useState } from "react";
import { Plus, Trash2, Lock, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ImageVersionsSettings, ImageVersionConfig } from "@/lib/types/home-settings";

const DEFAULT_VERSIONS: ImageVersionConfig[] = [
  { key: "main", prefix: "main_", width: 800, height: 800, is_default: true },
  { key: "gallery", prefix: "gallery_", width: 400, height: 400, is_default: true },
];

interface ImageVersionsSectionProps {
  value: ImageVersionsSettings;
  onChange: (value: ImageVersionsSettings) => void;
}

export default function ImageVersionsSection({ value, onChange }: ImageVersionsSectionProps) {
  const [newKey, setNewKey] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [newWidth, setNewWidth] = useState(600);
  const [newHeight, setNewHeight] = useState(600);

  const versions = value.versions.length > 0 ? value.versions : DEFAULT_VERSIONS;

  const updateVersion = (index: number, field: keyof ImageVersionConfig, fieldValue: string | number | boolean) => {
    const updated = [...versions];
    updated[index] = { ...updated[index], [field]: fieldValue };
    onChange({ ...value, versions: updated });
  };

  const addVersion = () => {
    const key = newKey.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    let prefix = newPrefix.trim();
    if (!key || !prefix) return;
    if (versions.some(v => v.key === key)) return;

    // Ensure prefix ends with _
    if (!prefix.endsWith("_")) prefix += "_";

    onChange({
      ...value,
      versions: [
        ...versions,
        { key, prefix, width: newWidth, height: newHeight, is_default: false },
      ],
    });
    setNewKey("");
    setNewPrefix("");
    setNewWidth(600);
    setNewHeight(600);
  };

  const removeVersion = (index: number) => {
    const updated = versions.filter((_, i) => i !== index);
    onChange({ ...value, versions: updated });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Image className="h-5 w-5 text-primary" />
          Image Versions
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Configure automatic image versions generated during PIM product upload.
          Each version creates a resized copy with a prefix (e.g., <code>main_</code>, <code>gallery_</code>).
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Enable toggle */}
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
          />
          <span className="text-sm font-medium text-slate-700">
            Enable automatic image version generation
          </span>
        </label>

        {value.enabled && (
          <>
            {/* Versions table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="pb-2 pr-4 font-medium">Key</th>
                    <th className="pb-2 pr-4 font-medium">Prefix</th>
                    <th className="pb-2 pr-4 font-medium">Width (px)</th>
                    <th className="pb-2 pr-4 font-medium">Height (px)</th>
                    <th className="pb-2 font-medium w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((version, index) => (
                    <tr key={version.key} className="group">
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          {version.is_default && (
                            <Lock className="h-3.5 w-3.5 text-slate-400" title="Built-in version" />
                          )}
                          <span className={version.is_default ? "text-slate-600 font-medium" : "text-slate-900"}>
                            {version.key}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        {version.is_default ? (
                          <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            {version.prefix}
                          </code>
                        ) : (
                          <input
                            type="text"
                            value={version.prefix}
                            onChange={(e) => updateVersion(index, "prefix", e.target.value)}
                            className="w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                          />
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          value={version.width}
                          onChange={(e) => updateVersion(index, "width", parseInt(e.target.value) || 0)}
                          min={50}
                          max={4000}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="py-3 pr-4">
                        <input
                          type="number"
                          value={version.height}
                          onChange={(e) => updateVersion(index, "height", parseInt(e.target.value) || 0)}
                          min={50}
                          max={4000}
                          className="w-24 rounded border border-slate-200 px-2 py-1 text-sm focus:border-primary focus:outline-none"
                        />
                      </td>
                      <td className="py-3">
                        {!version.is_default && (
                          <button
                            onClick={() => removeVersion(index)}
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Remove version"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add custom version */}
            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Add Custom Version</h3>
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Key</label>
                  <input
                    type="text"
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value)}
                    placeholder="e.g. thumb"
                    className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Prefix</label>
                  <input
                    type="text"
                    value={newPrefix}
                    onChange={(e) => setNewPrefix(e.target.value)}
                    placeholder="e.g. thumb_"
                    className="w-28 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Width</label>
                  <input
                    type="number"
                    value={newWidth}
                    onChange={(e) => setNewWidth(parseInt(e.target.value) || 0)}
                    min={50}
                    max={4000}
                    className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Height</label>
                  <input
                    type="number"
                    value={newHeight}
                    onChange={(e) => setNewHeight(parseInt(e.target.value) || 0)}
                    min={50}
                    max={4000}
                    className="w-20 rounded border border-slate-200 px-2 py-1.5 text-sm focus:border-primary focus:outline-none"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addVersion}
                  disabled={!newKey.trim() || !newPrefix.trim()}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
              <p className="text-xs text-blue-700">
                <strong>Note:</strong> The original image is always uploaded at full quality. Versions are resized
                copies with the prefix prepended to the filename (e.g., <code>main_photo.jpg</code>).
                Default versions (main, gallery) cannot be removed but their dimensions can be adjusted.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
