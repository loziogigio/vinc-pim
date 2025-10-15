"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePageBuilderStore } from "@/lib/store/pageBuilderStore";
import { getBlockTemplate } from "@/lib/config/blockTemplates";
import type { PageBlock } from "@/lib/types/blocks";

type DraftConfig = Record<string, unknown>;

const cloneConfig = (config: PageBlock["config"]): DraftConfig =>
  JSON.parse(JSON.stringify(config)) as DraftConfig;

type BlockSettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export const BlockSettingsModal = ({ open, onClose }: BlockSettingsModalProps) => {
  const blocks = usePageBuilderStore((state) => state.blocks);
  const selectedBlockId = usePageBuilderStore((state) => state.selectedBlockId);
  const updateBlockConfig = usePageBuilderStore((state) => state.updateBlockConfig);
  const selectBlock = usePageBuilderStore((state) => state.selectBlock);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId]
  );

  const [draft, setDraft] = useState<DraftConfig | null>(() =>
    selectedBlock ? cloneConfig(selectedBlock.config) : null
  );
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [advancedDraft, setAdvancedDraft] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const backgroundFileInputRef = useRef<HTMLInputElement | null>(null);
  const imageFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (selectedBlock) {
      const cloned = cloneConfig(selectedBlock.config);
      setDraft(cloned);
      setAdvancedDraft(JSON.stringify(cloned, null, 2));
    } else {
      setDraft(null);
      setAdvancedDraft("");
    }
    setHasLocalChanges(false);
    setJsonError(null);
    setUploadError(null);
  }, [selectedBlock, open]);

  const closeModal = () => {
    setUploadError(null);
    setJsonError(null);
    onClose();
  };

  const updateDraft = (updater: (current: DraftConfig) => DraftConfig) => {
    setDraft((previous) => {
      if (!previous) return previous;
      const next = updater(previous);
      if (next !== previous) {
        setHasLocalChanges(true);
        setJsonError(null);
        setAdvancedDraft(JSON.stringify(next, null, 2));
      }
      return next;
    });
  };

  const handleApply = () => {
    if (!selectedBlock || !draft) return;
    updateBlockConfig(selectedBlock.id, draft as Partial<PageBlock["config"]>);
    setHasLocalChanges(false);
    closeModal();
  };

  const template = selectedBlock ? getBlockTemplate(selectedBlock.type) : null;
  const rawCta = draft?.cta;
  const cta =
    rawCta && typeof rawCta === "object" ? (rawCta as Record<string, unknown>) : null;
  const hasTitle = draft ? typeof draft.title === "string" : false;
  const hasSubtitle = draft ? typeof draft.subtitle === "string" : false;
  const hasBackgroundColor = draft ? typeof draft.backgroundColor === "string" : false;
  const rawBackground = draft?.background;
  const background =
    rawBackground && typeof rawBackground === "object"
      ? (rawBackground as Record<string, unknown>)
      : null;
  const hasImage = draft ? typeof draft.image === "string" : false;
  const hasCollection = draft ? typeof draft.collection === "string" : false;
  const hasLimit = draft ? typeof draft.limit === "number" : false;
  const hasColumns = draft?.columns && typeof draft.columns === "object";
  const hasContent = draft ? typeof draft.content === "string" : false;
  const hasFeatures = draft ? Array.isArray(draft.features) : false;
  const hasTestimonials = draft ? Array.isArray(draft.testimonials) : false;
  const columnsRecord = hasColumns ? (draft?.columns as Record<string, unknown>) : null;

  const titleValue = hasTitle ? (draft?.title as string) : "";
  const subtitleValue = hasSubtitle ? (draft?.subtitle as string) : "";
  const contentValue = hasContent ? (draft?.content as string) : "";
  const backgroundColorValue = hasBackgroundColor ? (draft?.backgroundColor as string) : "#ffffff";
  const ctaText = cta && typeof cta.text === "string" ? (cta.text as string) : "";
  const ctaLink = cta && typeof cta.link === "string" ? (cta.link as string) : "";
  const ctaStyle = cta && typeof cta.style === "string" ? (cta.style as string) : "primary";
  const backgroundSrc =
    background && typeof background.src === "string" ? (background.src as string) : "";
  const backgroundAlt =
    background && typeof background.alt === "string" ? (background.alt as string) : "";
  const imageValue = hasImage ? (draft?.image as string) : "";
  const collectionValue = hasCollection ? (draft?.collection as string) : "";
  const limitValue = hasLimit ? (draft?.limit as number) : 0;
  const featureCount = hasFeatures && draft?.features ? (draft.features as unknown[]).length : 0;
  const testimonialCount =
    hasTestimonials && draft?.testimonials ? (draft.testimonials as unknown[]).length : 0;
  const blockLabel = template?.label ?? selectedBlock?.type.replace(/-/g, " ");
  const blockIdSnippet = selectedBlock?.id.slice(0, 12) ?? "";

  const handleUpload = async (file: File, applyUrl: (url: string) => void) => {
    setUploadError(null);
    if (!file) {
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setUploadError("File size must be 20MB or smaller.");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to upload file.");
      }

      const result = (await response.json()) as { url: string };
      applyUrl(result.url);
    } catch (error) {
      console.error("Upload failed", error);
      setUploadError(error instanceof Error ? error.message : "Failed to upload file.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      selectBlock(null);
    }
  }, [open, selectBlock]);

  if (!open || !selectedBlock || !draft) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-10 backdrop-blur-sm">
      <div
        role="presentation"
        className="absolute inset-0"
        onClick={closeModal}
        aria-hidden="true"
      />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Block Settings</h2>
            <p className="text-sm text-slate-500">
              {blockLabel} • <span className="font-mono text-xs text-slate-400">{blockIdSnippet}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-6">
            {hasTitle ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Title</label>
                <Input
                  value={titleValue}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, title: event.target.value }))
                  }
                  className="mt-2"
                />
              </div>
            ) : null}

            {hasSubtitle ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Subtitle</label>
                <textarea
                  value={subtitleValue}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, subtitle: event.target.value }))
                  }
                  rows={3}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ) : null}

            {hasContent ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Rich content</label>
                <textarea
                  value={contentValue}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, content: event.target.value }))
                  }
                  rows={6}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            ) : null}

            {cta ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-slate-700">Button text</label>
                  <Input
                    value={ctaText}
                    onChange={(event) =>
                      updateDraft((current) => {
                        const existing =
                          current.cta && typeof current.cta === "object"
                            ? (current.cta as Record<string, unknown>)
                            : {};
                        return {
                          ...current,
                          cta: { ...existing, text: event.target.value }
                        };
                      })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Button link</label>
                  <Input
                    value={ctaLink}
                    onChange={(event) =>
                      updateDraft((current) => {
                        const existing =
                          current.cta && typeof current.cta === "object"
                            ? (current.cta as Record<string, unknown>)
                            : {};
                        return {
                          ...current,
                          cta: { ...existing, link: event.target.value }
                        };
                      })
                    }
                    className="mt-2"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Button style</label>
                  <select
                    value={ctaStyle}
                    onChange={(event) =>
                      updateDraft((current) => {
                        const existing =
                          current.cta && typeof current.cta === "object"
                            ? (current.cta as Record<string, unknown>)
                            : {};
                        return {
                          ...current,
                          cta: { ...existing, style: event.target.value }
                        };
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="outline">Outline</option>
                  </select>
                </div>
              </div>
            ) : null}

            {hasBackgroundColor ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Background color</label>
                <div className="mt-2 flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundColorValue}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        backgroundColor: event.target.value
                      }))
                    }
                    className="h-12 w-16 cursor-pointer rounded-lg border border-slate-300"
                  />
                  <Input
                    value={backgroundColorValue}
                    onChange={(event) =>
                      updateDraft((current) => ({
                        ...current,
                        backgroundColor: event.target.value
                      }))
                    }
                  />
                </div>
              </div>
            ) : null}

            {background ? (
              <div className="space-y-4">
                <div
                  className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-orange-500"
                  onClick={() => backgroundFileInputRef.current?.click()}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    const file = event.dataTransfer.files?.[0];
                    if (file) {
                      const derivedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
                      void handleUpload(file, (url) =>
                        updateDraft((current) => {
                          const existingBackground =
                            current.background && typeof current.background === "object"
                              ? (current.background as Record<string, unknown>)
                              : {};
                          return {
                            ...current,
                            background: {
                              ...existingBackground,
                              src: url,
                              alt:
                                typeof existingBackground.alt === "string" &&
                                existingBackground.alt.trim().length > 0
                                  ? existingBackground.alt
                                  : derivedAlt
                            }
                          };
                        })
                      );
                    }
                  }}
                >
                  <ImageIcon className="mb-3 h-10 w-10 text-slate-400" />
                  <p className="text-sm text-slate-600">
                    {isUploading ? "Uploading…" : "Click to upload or drag and drop"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">PNG, JPG up to 20MB</p>
                  <input
                    ref={backgroundFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        const derivedAlt = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
                        void handleUpload(file, (url) =>
                          updateDraft((current) => {
                            const existingBackground =
                              current.background && typeof current.background === "object"
                                ? (current.background as Record<string, unknown>)
                                : {};
                            return {
                              ...current,
                              background: {
                                ...existingBackground,
                                src: url,
                                alt:
                                  typeof existingBackground.alt === "string" &&
                                  existingBackground.alt.trim().length > 0
                                    ? existingBackground.alt
                                    : derivedAlt
                              }
                            };
                          })
                        );
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
                <Input
                  value={backgroundSrc}
                  onChange={(event) =>
                    updateDraft((current) => {
                      const existingBackground =
                        current.background && typeof current.background === "object"
                          ? (current.background as Record<string, unknown>)
                          : {};
                      return {
                        ...current,
                        background: { ...existingBackground, src: event.target.value }
                      };
                    })
                  }
                  placeholder="https://"
                />
                <Input
                  value={backgroundAlt}
                  onChange={(event) =>
                    updateDraft((current) => {
                      const existingBackground =
                        current.background && typeof current.background === "object"
                          ? (current.background as Record<string, unknown>)
                          : {};
                      return {
                        ...current,
                        background: { ...existingBackground, alt: event.target.value }
                      };
                    })
                  }
                  placeholder="Describe the image (alt text)"
                />
                {uploadError ? <p className="text-xs text-red-500">{uploadError}</p> : null}
              </div>
            ) : null}

            {hasImage ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Image URL</label>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    value={imageValue}
                    onChange={(event) =>
                      updateDraft((current) => ({ ...current, image: event.target.value }))
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => imageFileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? "Uploading…" : "Upload"}
                  </Button>
                  <input
                    ref={imageFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        void handleUpload(file, (url) =>
                          updateDraft((current) => ({ ...current, image: url }))
                        );
                      }
                      event.target.value = "";
                    }}
                  />
                </div>
              </div>
            ) : null}

            {hasCollection ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Collection handle</label>
                <Input
                  value={collectionValue}
                  onChange={(event) =>
                    updateDraft((current) => ({ ...current, collection: event.target.value }))
                  }
                  className="mt-2"
                />
              </div>
            ) : null}

            {hasLimit ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Items limit</label>
                <Input
                  type="number"
                  value={limitValue}
                  min={1}
                  onChange={(event) =>
                    updateDraft((current) => ({
                      ...current,
                      limit: Number.parseInt(event.target.value, 10) || 0
                    }))
                  }
                  className="mt-2"
                />
              </div>
            ) : null}

            {hasColumns ? (
              <div>
                <label className="text-sm font-medium text-slate-700">Columns per device</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {["mobile", "tablet", "desktop"].map((breakpoint) => {
                    const columnValue =
                      columnsRecord && typeof columnsRecord[breakpoint] === "number"
                        ? (columnsRecord[breakpoint] as number)
                        : 0;
                    return (
                      <div key={breakpoint} className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <span className="text-xs font-semibold uppercase text-slate-500">
                          {breakpoint}
                        </span>
                        <Input
                          type="number"
                          value={columnValue}
                          min={1}
                          max={6}
                          onChange={(event) =>
                            updateDraft((current) => {
                              const existingColumns =
                                current.columns && typeof current.columns === "object"
                                  ? (current.columns as Record<string, unknown>)
                                  : {};
                              return {
                                ...current,
                                columns: {
                                  ...existingColumns,
                                  [breakpoint]: Number.parseInt(event.target.value, 10) || 0
                                }
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {hasFeatures ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                {featureCount} features configured. Detailed editing coming soon—use the Advanced JSON
                editor below for now.
              </div>
            ) : null}

            {hasTestimonials ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                {testimonialCount} testimonials configured. Use the Advanced JSON editor to manage
                quotes and ratings.
              </div>
            ) : null}

            <details className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-600">
                Advanced JSON editor
              </summary>
              <textarea
                value={advancedDraft}
                onChange={(event) => {
                  const value = event.target.value;
                  setAdvancedDraft(value);
                  try {
                    const parsed = JSON.parse(value) as DraftConfig;
                    setDraft(parsed);
                    setHasLocalChanges(true);
                    setJsonError(null);
                  } catch {
                    setJsonError("Invalid JSON syntax. Fix the errors before applying.");
                  }
                }}
                className="h-64 w-full border-t border-slate-200 bg-white px-4 py-3 text-xs font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-orange-500"
                spellCheck={false}
              />
              {jsonError ? <p className="px-4 pb-4 text-xs text-red-500">{jsonError}</p> : null}
            </details>
          </div>
        </div>

        <footer className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
          {hasLocalChanges && (
            <div className="mr-auto text-xs text-amber-600">
              Unsaved changes
            </div>
          )}
          <Button variant="ghost" onClick={closeModal} className="rounded-lg px-4 py-2">
            Cancel
          </Button>
          <Button
            type="button"
            className="rounded-lg bg-orange-500 px-4 py-2 text-white hover:bg-orange-600"
            onClick={handleApply}
            disabled={!hasLocalChanges}
          >
            Save changes
          </Button>
        </footer>
      </div>
    </div>
  );
};
