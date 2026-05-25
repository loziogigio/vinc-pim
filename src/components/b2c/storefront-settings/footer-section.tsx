"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Loader2, Send, Save, Upload, Code, LayoutGrid, Type, Link as LinkIcon, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SectionCard } from "./section-card";
import { Field, ColorField, inputClass } from "./field-helpers";
import type { IB2CStorefrontFooter } from "./types";
import type { IFooterColumn, IFooterColumnItem, FooterItemType } from "@/lib/db/models/b2c-storefront";
import { useImageUpload } from "@/hooks/useImageUpload";

const ITEM_TYPE_BUTTONS: { type: FooterItemType; label: string; Icon: typeof Type }[] = [
  { type: "text", label: "Text", Icon: Type },
  { type: "image", label: "Image", Icon: ImageIcon },
  { type: "link", label: "Link", Icon: LinkIcon },
];

// ============================================
// Footer Preview
// NOTE: This surface intentionally renders a public-storefront mockup.
// The preview area bg/text color uses the user-configured footer colors
// (inline styles). Only the chrome (border, label) around it is themed.
// ============================================

function FooterPreview({ footer }: { footer: IB2CStorefrontFooter }) {
  const bgColor = footer.bg_color || "#1f2937";
  const textColor = footer.text_color || "#d1d5db";
  const columns = footer.columns || [];

  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border bg-muted px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
      </div>
      {/* Preview surface renders public storefront mockup — intentionally uses custom colors */}
      <div className="p-3" style={{ backgroundColor: bgColor, color: textColor }}>
        {footer.show_newsletter && (
          <div className="mb-4 text-center">
            <p className="text-sm font-semibold" style={{ color: textColor }}>
              {footer.newsletter_heading || "Stay updated"}
            </p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="h-7 w-32 rounded bg-white/10 px-2 flex items-center">
                <span className="text-[10px] opacity-50">{footer.newsletter_placeholder || "Enter your email"}</span>
              </div>
              <div className="h-7 w-16 rounded bg-white/20 flex items-center justify-center">
                <span className="text-[10px]">Subscribe</span>
              </div>
            </div>
          </div>
        )}

        {/* HTML mode preview */}
        {footer.footer_html_draft ? (
          <div className="mb-3 text-[10px] opacity-80 line-clamp-4" dangerouslySetInnerHTML={{ __html: footer.footer_html_draft }} />
        ) : columns.length > 0 && (
          <div className="flex gap-4 mb-3">
            {columns.map((col, i) => {
              const items = col.items;
              return (
                <div key={i} className="flex-1 min-w-0">
                  <p className="text-xs font-semibold mb-1 truncate" style={{ color: textColor }}>
                    {col.title || "Column"}
                  </p>
                  {items ? items.map((item, j) => (
                    <div key={j}>
                      {item.type === "text" && <p className="text-[10px] opacity-70 line-clamp-2">{item.text_content || "..."}</p>}
                      {item.type === "link" && <p className="text-[10px] opacity-70 truncate">{item.label || "Link"}</p>}
                      {item.type === "image" && (
                        item.image_url
                          ? <img src={item.image_url} alt={item.image_alt || ""} className="max-h-8 object-contain my-0.5" />
                          : <span className="text-[10px] opacity-40">[Image]</span>
                      )}
                    </div>
                  )) : col.links.map((link, j) => (
                    <p key={j} className="text-[10px] opacity-70 truncate">{link.label || "Link"}</p>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {footer.copyright_text && (
          <p className="text-[10px] opacity-50 text-center border-t border-white/10 pt-2 mt-2">
            {footer.copyright_text}
          </p>
        )}

        {!footer.copyright_text && columns.length === 0 && !footer.show_newsletter && !footer.footer_html_draft && (
          <p className="text-[10px] opacity-40 text-center py-4">Footer preview will appear here</p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Image Item Editor (extracted to manage its own file input ref)
// ============================================

function ImageItemEditor({ item, onChange }: { item: IFooterColumnItem; onChange: (updates: Partial<IFooterColumnItem>) => void }) {
  const { uploadState, uploadImage } = useImageUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    const url = await uploadImage(file);
    if (url) onChange({ image_url: url });
  };

  return (
    <div className="space-y-2">
      {item.image_url && (
        <div className="relative inline-block">
          <img src={item.image_url} alt={item.image_alt || ""} className="max-h-20 rounded border border-border object-contain" />
          <button type="button" onClick={() => onChange({ image_url: undefined })} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-0.5 text-white hover:bg-red-600">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadState.isUploading}
          className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
        >
          {uploadState.isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {uploadState.isUploading ? "Uploading..." : "Upload"}
        </button>
        <input type="text" value={item.image_url || ""} onChange={(e) => onChange({ image_url: e.target.value })} placeholder="Paste image URL" className={`${inputClass} flex-1 text-xs`} />
      </div>
      {uploadState.error && <p className="text-xs text-red-500 dark:text-red-400">{uploadState.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <input type="text" value={item.image_alt || ""} onChange={(e) => onChange({ image_alt: e.target.value })} placeholder="Alt text" className={`${inputClass} text-xs`} />
        <input type="text" inputMode="numeric" value={item.image_max_width ?? ""} onChange={(e) => onChange({ image_max_width: e.target.value ? parseInt(e.target.value, 10) : undefined })} placeholder="Max width (px)" className={`${inputClass} text-xs`} />
      </div>
    </div>
  );
}

// ============================================
// Footer Column Editor (mixed items)
// ============================================

function FooterColumnEditor({
  col, colIdx, onUpdateColumn, onRemoveColumn,
}: {
  col: IFooterColumn;
  colIdx: number;
  onUpdateColumn: (index: number, col: IFooterColumn) => void;
  onRemoveColumn: (index: number) => void;
}) {
  const items = col.items || col.links.map((l): IFooterColumnItem => ({ type: "link", label: l.label, href: l.href, open_in_new_tab: l.open_in_new_tab }));

  function setItems(newItems: IFooterColumnItem[]) {
    onUpdateColumn(colIdx, { ...col, items: newItems, links: [] });
  }

  function addItem(type: FooterItemType) {
    setItems([...items, { type }]);
  }

  function updateItem(idx: number, updates: Partial<IFooterColumnItem>) {
    const updated = [...items];
    updated[idx] = { ...updated[idx], ...updates };
    setItems(updated);
  }

  function removeItem(idx: number) {
    setItems(items.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
      {/* Column header */}
      <div className="flex items-center gap-2">
        <input type="text" value={col.title} onChange={(e) => onUpdateColumn(colIdx, { ...col, title: e.target.value })} placeholder="Column title" className={`${inputClass} flex-1 font-medium`} />
        <button type="button" onClick={() => onRemoveColumn(colIdx)} className="p-1 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
      </div>

      {/* Items */}
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 pl-3 border-l-2 border-border">
          <div className="flex-1 space-y-1">
            {/* Text item */}
            {item.type === "text" && (
              <textarea
                value={item.text_content || ""}
                onChange={(e) => updateItem(idx, { text_content: e.target.value })}
                rows={3}
                placeholder="Address, phone, opening hours..."
                className={`${inputClass} w-full text-xs`}
              />
            )}

            {/* Link item */}
            {item.type === "link" && (
              <div className="flex items-center gap-2">
                <input type="text" value={item.label || ""} onChange={(e) => updateItem(idx, { label: e.target.value })} placeholder="Label" className={`${inputClass} flex-1`} />
                <input type="text" value={item.href || ""} onChange={(e) => updateItem(idx, { href: e.target.value })} placeholder="/page or https://..." className={`${inputClass} flex-1`} />
              </div>
            )}

            {/* Image item */}
            {item.type === "image" && (
              <ImageItemEditor item={item} onChange={(updates) => updateItem(idx, updates)} />
            )}
          </div>
          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground uppercase">{item.type}</span>
            <button type="button" onClick={() => removeItem(idx)} className="p-0.5 text-muted-foreground hover:text-red-500 dark:hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}

      {/* Add item buttons */}
      <div className="flex items-center gap-1.5 pl-3">
        {ITEM_TYPE_BUTTONS.map(({ type, label, Icon }) => (
          <button
            key={type}
            type="button"
            onClick={() => addItem(type)}
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 rounded border border-dashed border-primary/30 px-2 py-1 hover:bg-primary/5"
          >
            <Icon className="h-3 w-3" /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Footer Section
// ============================================

export function FooterSection({
  footer,
  footerDraft,
  onDraftChange,
  onPublish,
  saving,
  onSave,
}: {
  footer: IB2CStorefrontFooter;
  footerDraft: IB2CStorefrontFooter;
  onDraftChange: (f: IB2CStorefrontFooter) => void;
  onPublish: () => Promise<void>;
  saving: boolean;
  onSave: () => void;
}) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [confirmSwitchToStructured, setConfirmSwitchToStructured] = useState(false);
  const hasUnpublishedChanges = JSON.stringify(footerDraft) !== JSON.stringify(footer);
  const isHtmlMode = footerDraft.footer_html_draft !== undefined;

  const handlePublish = async () => {
    setIsPublishing(true);
    try { await onPublish(); } finally { setIsPublishing(false); }
  };

  function update<K extends keyof IB2CStorefrontFooter>(key: K, value: IB2CStorefrontFooter[K]) {
    onDraftChange({ ...footerDraft, [key]: value });
  }

  // Column helpers
  function addColumn() {
    update("columns", [...(footerDraft.columns || []), { title: "", items: [], links: [] }]);
  }
  function updateColumnObj(index: number, col: IFooterColumn) {
    const cols = [...(footerDraft.columns || [])];
    cols[index] = col;
    update("columns", cols);
  }
  function removeColumn(index: number) {
    update("columns", (footerDraft.columns || []).filter((_, i) => i !== index));
  }

  // Editor mode switching. Going from HTML → Structured discards the custom HTML,
  // so confirm first when there is something to lose.
  function switchToHtmlMode() {
    update("footer_html_draft", footerDraft.footer_html_draft || footerDraft.footer_html || "");
  }
  function switchToStructuredMode() {
    if (footerDraft.footer_html_draft) {
      setConfirmSwitchToStructured(true);
      return;
    }
    update("footer_html_draft", undefined);
  }
  function confirmSwitchToStructuredMode() {
    setConfirmSwitchToStructured(false);
    update("footer_html_draft", undefined);
  }

  return (
    <div className="space-y-4">
      {/* Status and Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges ? (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">Draft has unpublished changes</span>
          ) : (footer.columns?.length || footer.copyright_text) ? (
            <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">Published</span>
          ) : (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">No footer configured</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges && (footer.columns?.length || footer.copyright_text) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onDraftChange(footer)} className="text-xs text-muted-foreground">
              Revert to Published
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button type="button" size="sm" onClick={handlePublish} disabled={isPublishing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white">
            {isPublishing ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</> : <><Send className="h-4 w-4" /> Publish</>}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionCard title="Footer Settings" description="Configure footer content, links, and appearance.">
            {/* Colors */}
            <div className="grid gap-4 md:grid-cols-2">
              <ColorField label="Background Color" value={footerDraft.bg_color || ""} onChange={(v) => update("bg_color", v)} />
              <ColorField label="Text Color" value={footerDraft.text_color || ""} onChange={(v) => update("text_color", v)} />
            </div>

            {/* Copyright */}
            <Field label="Copyright Text" helper="e.g., (c) 2026 Company Srl - P.IVA 12345678901">
              <input type="text" value={footerDraft.copyright_text || ""} onChange={(e) => update("copyright_text", e.target.value)} placeholder="(c) 2026 My Company" className={inputClass} />
            </Field>

            {/* Newsletter */}
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <input type="checkbox" checked={footerDraft.show_newsletter || false} onChange={(e) => update("show_newsletter", e.target.checked)} className="rounded border-border" />
                Show Newsletter Signup
              </label>
              {footerDraft.show_newsletter && (
                <div className="grid gap-3 md:grid-cols-2 rounded-lg border border-border bg-muted/50 p-4">
                  <Field label="Heading">
                    <input type="text" value={footerDraft.newsletter_heading || ""} onChange={(e) => update("newsletter_heading", e.target.value)} placeholder="Stay updated" className={inputClass} />
                  </Field>
                  <Field label="Placeholder">
                    <input type="text" value={footerDraft.newsletter_placeholder || ""} onChange={(e) => update("newsletter_placeholder", e.target.value)} placeholder="Enter your email" className={inputClass} />
                  </Field>
                </div>
              )}
            </div>

            {/* Editor Mode Toggle */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Footer Content</p>
                <div className="flex items-center gap-1 rounded-lg border border-border bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={switchToStructuredMode}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${!isHtmlMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <LayoutGrid className="h-3 w-3" /> Structured
                  </button>
                  <button
                    type="button"
                    onClick={switchToHtmlMode}
                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${isHtmlMode ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Code className="h-3 w-3" /> HTML
                  </button>
                </div>
              </div>

              {/* HTML Editor Mode */}
              {isHtmlMode ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Write custom HTML for the entire footer. This replaces the structured columns.</p>
                  <textarea
                    value={footerDraft.footer_html_draft || ""}
                    onChange={(e) => update("footer_html_draft", e.target.value)}
                    rows={12}
                    placeholder={"<div class='container'>\n  <div class='row'>\n    <div class='col'>Your footer content...</div>\n  </div>\n</div>"}
                    className={`${inputClass} w-full font-mono text-xs`}
                  />
                  <p className="text-[10px] text-muted-foreground">{(footerDraft.footer_html_draft || "").length} characters</p>
                </div>
              ) : (
                /* Structured Columns Mode */
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={addColumn}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 rounded-md border border-dashed border-primary/30 px-2.5 py-1.5 hover:bg-primary/5"
                  >
                    <Plus className="h-3 w-3" /> Add Column
                  </button>
                  {(footerDraft.columns || []).map((col, colIdx) => (
                    <FooterColumnEditor
                      key={colIdx}
                      col={col}
                      colIdx={colIdx}
                      onUpdateColumn={updateColumnObj}
                      onRemoveColumn={removeColumn}
                    />
                  ))}
                </div>
              )}
            </div>

        </SectionCard>

        {/* Preview */}
        <FooterPreview footer={footerDraft} />
      </div>

      <ConfirmDialog
        open={confirmSwitchToStructured}
        title="Discard custom HTML?"
        message="Switching to Structured mode will remove the custom footer HTML. This can't be undone unless you cancel now."
        confirmText="Discard HTML"
        cancelText="Keep HTML"
        variant="warning"
        onConfirm={confirmSwitchToStructuredMode}
        onCancel={() => setConfirmSwitchToStructured(false)}
      />
    </div>
  );
}
