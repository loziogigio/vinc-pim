"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Send, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "./section-card";
import { Field, ColorField, inputClass } from "./field-helpers";
import type { IB2CStorefrontFooter } from "./types";
import type { IFooterColumn, IFooterSocial } from "@/lib/db/models/b2c-storefront";

const SOCIAL_PLATFORMS = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "X / Twitter" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "pinterest", label: "Pinterest" },
];

// ============================================
// Footer Preview
// ============================================

function FooterPreview({ footer }: { footer: IB2CStorefrontFooter }) {
  const bgColor = footer.bg_color || "#1f2937";
  const textColor = footer.text_color || "#d1d5db";
  const columns = footer.columns || [];
  const socialLinks = footer.social_links || [];

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2">
        <span className="text-xs font-medium text-slate-600">Live Preview</span>
      </div>
      <div className="p-3" style={{ backgroundColor: bgColor, color: textColor }}>
        {/* Newsletter */}
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

        {/* Columns */}
        {columns.length > 0 && (
          <div className="flex gap-4 mb-3">
            {columns.map((col, i) => (
              <div key={i} className="flex-1 min-w-0">
                <p className="text-xs font-semibold mb-1 truncate" style={{ color: textColor }}>
                  {col.title || "Column"}
                </p>
                {col.links.map((link, j) => (
                  <p key={j} className="text-[10px] opacity-70 truncate">{link.label || "Link"}</p>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Social Links */}
        {socialLinks.length > 0 && (
          <div className="flex gap-2 mb-2">
            {socialLinks.map((social, i) => (
              <div key={i} className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-[8px] font-bold uppercase">{(social.platform || "?")[0]}</span>
              </div>
            ))}
          </div>
        )}

        {/* Copyright */}
        {footer.copyright_text && (
          <p className="text-[10px] opacity-50 text-center border-t border-white/10 pt-2 mt-2">
            {footer.copyright_text}
          </p>
        )}

        {!footer.copyright_text && columns.length === 0 && socialLinks.length === 0 && !footer.show_newsletter && (
          <p className="text-[10px] opacity-40 text-center py-4">Footer preview will appear here</p>
        )}
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
  const hasUnpublishedChanges = JSON.stringify(footerDraft) !== JSON.stringify(footer);

  const handlePublish = async () => {
    setIsPublishing(true);
    try { await onPublish(); } finally { setIsPublishing(false); }
  };

  function update<K extends keyof IB2CStorefrontFooter>(key: K, value: IB2CStorefrontFooter[K]) {
    onDraftChange({ ...footerDraft, [key]: value });
  }

  // Column helpers
  function addColumn() {
    update("columns", [...(footerDraft.columns || []), { title: "", links: [] }]);
  }
  function updateColumn(index: number, title: string) {
    const cols = [...(footerDraft.columns || [])];
    cols[index] = { ...cols[index], title };
    update("columns", cols);
  }
  function removeColumn(index: number) {
    update("columns", (footerDraft.columns || []).filter((_, i) => i !== index));
  }
  function addLink(colIndex: number) {
    const cols = [...(footerDraft.columns || [])];
    cols[colIndex] = { ...cols[colIndex], links: [...cols[colIndex].links, { label: "", href: "" }] };
    update("columns", cols);
  }
  function updateLink(colIndex: number, linkIndex: number, field: string, value: string | boolean) {
    const cols = [...(footerDraft.columns || [])];
    const links = [...cols[colIndex].links];
    links[linkIndex] = { ...links[linkIndex], [field]: value };
    cols[colIndex] = { ...cols[colIndex], links };
    update("columns", cols);
  }
  function removeLink(colIndex: number, linkIndex: number) {
    const cols = [...(footerDraft.columns || [])];
    cols[colIndex] = { ...cols[colIndex], links: cols[colIndex].links.filter((_, i) => i !== linkIndex) };
    update("columns", cols);
  }

  // Social helpers
  function addSocial() {
    update("social_links", [...(footerDraft.social_links || []), { platform: "", url: "" }]);
  }
  function updateSocial(index: number, field: keyof IFooterSocial, value: string) {
    const links = [...(footerDraft.social_links || [])];
    links[index] = { ...links[index], [field]: value };
    update("social_links", links);
  }
  function removeSocial(index: number) {
    update("social_links", (footerDraft.social_links || []).filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {/* Status and Actions Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700">Draft has unpublished changes</span>
          ) : (footer.columns?.length || footer.copyright_text) ? (
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">Published</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">No footer configured</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasUnpublishedChanges && (footer.columns?.length || footer.copyright_text) && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onDraftChange(footer)} className="text-xs text-slate-500">
              Revert to Published
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button type="button" size="sm" onClick={handlePublish} disabled={isPublishing} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            {isPublishing ? <><Loader2 className="h-4 w-4 animate-spin" /> Publishing...</> : <><Send className="h-4 w-4" /> Publish</>}
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Form */}
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
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input type="checkbox" checked={footerDraft.show_newsletter || false} onChange={(e) => update("show_newsletter", e.target.checked)} className="rounded border-slate-200" />
                Show Newsletter Signup
              </label>
              {footerDraft.show_newsletter && (
                <div className="grid gap-3 md:grid-cols-2 rounded-lg border border-slate-200 bg-gray-50 p-4">
                  <Field label="Heading">
                    <input type="text" value={footerDraft.newsletter_heading || ""} onChange={(e) => update("newsletter_heading", e.target.value)} placeholder="Stay updated" className={inputClass} />
                  </Field>
                  <Field label="Placeholder">
                    <input type="text" value={footerDraft.newsletter_placeholder || ""} onChange={(e) => update("newsletter_placeholder", e.target.value)} placeholder="Enter your email" className={inputClass} />
                  </Field>
                </div>
              )}
            </div>

            {/* Footer Columns */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Link Columns</p>
                <button type="button" onClick={addColumn} className="inline-flex items-center gap-1 text-xs font-medium text-[#009688] hover:text-[#00796b]">
                  <Plus className="h-3.5 w-3.5" /> Add column
                </button>
              </div>
              {(footerDraft.columns || []).map((col, colIdx) => (
                <div key={colIdx} className="rounded-lg border border-slate-200 bg-gray-50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <input type="text" value={col.title} onChange={(e) => updateColumn(colIdx, e.target.value)} placeholder="Column title" className={`${inputClass} flex-1 font-medium`} />
                    <button type="button" onClick={() => removeColumn(colIdx)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {col.links.map((link, linkIdx) => (
                    <div key={linkIdx} className="flex items-center gap-2 pl-4">
                      <input type="text" value={link.label} onChange={(e) => updateLink(colIdx, linkIdx, "label", e.target.value)} placeholder="Label" className={`${inputClass} flex-1`} />
                      <input type="text" value={link.href} onChange={(e) => updateLink(colIdx, linkIdx, "href", e.target.value)} placeholder="/page" className={`${inputClass} flex-1`} />
                      <button type="button" onClick={() => removeLink(colIdx, linkIdx)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                  <button type="button" onClick={() => addLink(colIdx)} className="ml-4 inline-flex items-center gap-1 text-xs text-[#009688] hover:text-[#00796b]">
                    <Plus className="h-3 w-3" /> Add link
                  </button>
                </div>
              ))}
            </div>

            {/* Social Links */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Social Links</p>
                <button type="button" onClick={addSocial} className="inline-flex items-center gap-1 text-xs font-medium text-[#009688] hover:text-[#00796b]">
                  <Plus className="h-3.5 w-3.5" /> Add social
                </button>
              </div>
              {(footerDraft.social_links || []).map((social, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select value={social.platform} onChange={(e) => updateSocial(i, "platform", e.target.value)} className={`${inputClass} w-36`}>
                    <option value="">Platform</option>
                    {SOCIAL_PLATFORMS.map((p) => (<option key={p.value} value={p.value}>{p.label}</option>))}
                  </select>
                  <input type="text" value={social.url} onChange={(e) => updateSocial(i, "url", e.target.value)} placeholder="https://..." className={`${inputClass} flex-1`} />
                  <button type="button" onClick={() => removeSocial(i)} className="p-1 text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
        </SectionCard>

        {/* Preview */}
        <FooterPreview footer={footerDraft} />
      </div>
    </div>
  );
}
