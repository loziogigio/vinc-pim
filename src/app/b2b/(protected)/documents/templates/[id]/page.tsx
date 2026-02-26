"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Loader2,
  Star,
  Eye,
  Lock,
  Image,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  FileText,
  Hash,
  CheckCircle,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  PAGE_SIZES,
  PAGE_ORIENTATIONS,
  HEADER_STYLES,
  HEADER_STYLE_LABELS,
  LOGO_POSITIONS,
  LOGO_POSITION_LABELS,
  DEFAULT_HEADER_CONFIG,
  DEFAULT_FOOTER_CONFIG,
} from "@/lib/constants/document";
import type {
  HeaderStyle,
  LogoPosition,
  TemplateHeaderConfig,
  TemplateFooterConfig,
} from "@/lib/constants/document";
import { buildPreviewHtml } from "@/lib/utils/document-preview";

interface Template {
  template_id: string;
  name: string;
  description?: string;
  document_type: string;
  html_template: string;
  css_styles?: string;
  page_size: string;
  orientation: string;
  margins: { top: number; right: number; bottom: number; left: number };
  header_config?: TemplateHeaderConfig;
  footer_config?: TemplateFooterConfig;
  is_default: boolean;
  is_system: boolean;
}

export default function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [templateId, setTemplateId] = useState("");
  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "config">("editor");

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDocType, setEditDocType] = useState("all");
  const [editHtml, setEditHtml] = useState("");
  const [editCss, setEditCss] = useState("");
  const [editPageSize, setEditPageSize] = useState("A4");
  const [editOrientation, setEditOrientation] = useState("portrait");
  const [editMargins, setEditMargins] = useState({
    top: 15,
    right: 15,
    bottom: 15,
    left: 15,
  });
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editHeaderConfig, setEditHeaderConfig] = useState<TemplateHeaderConfig>(DEFAULT_HEADER_CONFIG);
  const [editFooterConfig, setEditFooterConfig] = useState<TemplateFooterConfig>(DEFAULT_FOOTER_CONFIG);

  useEffect(() => {
    params.then(({ id }) => setTemplateId(id));
  }, [params]);

  const fetchTemplate = useCallback(async () => {
    if (!templateId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/documents/templates/${templateId}`);
      const data = await res.json();
      if (data.success && data.template) {
        const t = data.template;
        setTemplate(t);
        setEditName(t.name);
        setEditDescription(t.description || "");
        setEditDocType(t.document_type || "all");
        setEditHtml(t.html_template || "");
        setEditCss(t.css_styles || "");
        setEditPageSize(t.page_size || "A4");
        setEditOrientation(t.orientation || "portrait");
        setEditMargins(
          t.margins || { top: 15, right: 15, bottom: 15, left: 15 },
        );
        setEditIsDefault(t.is_default || false);
        setEditHeaderConfig(t.header_config || DEFAULT_HEADER_CONFIG);
        setEditFooterConfig(t.footer_config || DEFAULT_FOOTER_CONFIG);
      }
    } catch (err) {
      console.error("Failed to fetch template:", err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  // Build preview HTML with sample data replacing all {{placeholders}}
  // Must be before early returns to satisfy Rules of Hooks
  const previewHtml = useMemo(
    () => buildPreviewHtml(editHtml, editHeaderConfig, editFooterConfig),
    [editHtml, editHeaderConfig, editFooterConfig]
  );

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/b2b/documents/templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription || undefined,
          document_type: editDocType,
          html_template: editHtml,
          css_styles: editCss || undefined,
          page_size: editPageSize,
          orientation: editOrientation,
          margins: editMargins,
          header_config: editHeaderConfig,
          footer_config: editFooterConfig,
          is_default: editIsDefault,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTemplate(data.template);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        alert(data.error || "Errore nel salvataggio");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Template non trovato.
      </div>
    );
  }

  const isSystem = template.is_system;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() =>
              router.push(`${tenantPrefix}/b2b/documents/templates`)
            }
            className="p-2 rounded-lg hover:bg-[#f8f8f8]"
          >
            <ArrowLeft className="w-5 h-5 text-[#5e5873]" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-[#5e5873]">
                {template.name}
              </h1>
              {isSystem && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                  <Lock className="w-3 h-3" />
                  Sistema
                </span>
              )}
              {template.is_default && (
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              )}
            </div>
            {isSystem && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Template di sistema — duplica per personalizzare il codice HTML/CSS
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Editor" : "Anteprima"}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              saveSuccess
                ? "bg-green-500 text-white"
                : "bg-[#009688] text-white hover:bg-[#00796b]"
            } disabled:opacity-50`}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveSuccess ? "Salvato!" : "Salva"}
          </button>
        </div>
      </div>

      {/* Template Settings Row */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="grid grid-cols-6 gap-4">
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              Nome
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ebe9f1] rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              Tipo Documento
            </label>
            <select
              value={editDocType}
              onChange={(e) => setEditDocType(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ebe9f1] rounded text-sm"
            >
              <option value="all">Tutti i tipi</option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DOCUMENT_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              Formato
            </label>
            <select
              value={editPageSize}
              onChange={(e) => setEditPageSize(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ebe9f1] rounded text-sm"
            >
              {PAGE_SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              Orientamento
            </label>
            <select
              value={editOrientation}
              onChange={(e) => setEditOrientation(e.target.value)}
              className="w-full px-2 py-1.5 border border-[#ebe9f1] rounded text-sm"
            >
              {PAGE_ORIENTATIONS.map((o) => (
                <option key={o} value={o}>
                  {o === "portrait" ? "Verticale" : "Orizzontale"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-1">
              Descrizione
            </label>
            <input
              type="text"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Opzionale..."
              className="w-full px-2 py-1.5 border border-[#ebe9f1] rounded text-sm"
            />
          </div>
          <div className="flex items-end gap-2 pb-0.5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editIsDefault}
                onChange={(e) => setEditIsDefault(e.target.checked)}
                className="rounded border-[#ebe9f1]"
              />
              <Star className="w-4 h-4 text-amber-500" />
              Predefinito
            </label>
          </div>
        </div>

        {/* Margins */}
        <div className="mt-3 flex items-center gap-4">
          <span className="text-xs font-medium text-[#5e5873]">
            Margini (mm):
          </span>
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <div key={side} className="flex items-center gap-1">
              <label className="text-xs text-muted-foreground">
                {side === "top"
                  ? "Su"
                  : side === "right"
                    ? "Dx"
                    : side === "bottom"
                      ? "Gi\u00f9"
                      : "Sx"}
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={editMargins[side]}
                onChange={(e) =>
                  setEditMargins({
                    ...editMargins,
                    [side]: parseInt(e.target.value) || 0,
                  })
                }
                className="w-16 px-2 py-1 border border-[#ebe9f1] rounded text-sm text-center"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tabs: Editor / Config */}
      <div className="flex items-center gap-1 border-b border-[#ebe9f1]">
        <button
          onClick={() => setActiveTab("editor")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "editor"
              ? "border-[#009688] text-[#009688]"
              : "border-transparent text-muted-foreground hover:text-[#5e5873]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <FileText className="w-4 h-4" />
            HTML / CSS
          </span>
        </button>
        <button
          onClick={() => setActiveTab("config")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "config"
              ? "border-[#009688] text-[#009688]"
              : "border-transparent text-muted-foreground hover:text-[#5e5873]"
          }`}
        >
          <span className="inline-flex items-center gap-1.5">
            <Type className="w-4 h-4" />
            Header e Footer
          </span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === "editor" ? (
        showPreview ? (
          <div className="bg-white rounded-lg border border-[#ebe9f1] overflow-hidden">
            <div className="p-2 bg-[#f8f8f8] border-b border-[#ebe9f1] text-xs text-muted-foreground">
              Anteprima documento con dati di esempio
            </div>
            <div className="p-4">
              <iframe
                srcDoc={`<style>${editCss}</style>${previewHtml}`}
                className="w-full border border-[#ebe9f1] rounded"
                style={{ minHeight: "600px" }}
                title="Template Preview"
              />
            </div>
          </div>
        ) : (
          <>
            {isSystem && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                <strong>Template di sistema:</strong> il codice HTML/CSS non \u00e8 modificabile.
                Duplica questo template dalla lista per creare una copia personalizzabile.
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-[#ebe9f1]">
                <div className="p-2 bg-[#f8f8f8] border-b border-[#ebe9f1] text-xs font-medium text-[#5e5873]">
                  HTML Template
                </div>
                <textarea
                  value={editHtml}
                  onChange={(e) => setEditHtml(e.target.value)}
                  readOnly={isSystem}
                  className={`w-full p-3 text-sm font-mono focus:outline-none resize-none ${isSystem ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                  style={{ minHeight: "500px" }}
                  spellCheck={false}
                />
              </div>
              <div className="bg-white rounded-lg border border-[#ebe9f1]">
                <div className="p-2 bg-[#f8f8f8] border-b border-[#ebe9f1] text-xs font-medium text-[#5e5873]">
                  CSS Styles
                </div>
                <textarea
                  value={editCss}
                  onChange={(e) => setEditCss(e.target.value)}
                  readOnly={isSystem}
                  className={`w-full p-3 text-sm font-mono focus:outline-none resize-none ${isSystem ? "bg-gray-50 text-gray-500 cursor-not-allowed" : ""}`}
                  style={{ minHeight: "500px" }}
                  spellCheck={false}
                />
              </div>
            </div>
          </>
        )
      ) : (
        <HeaderFooterConfig
          headerConfig={editHeaderConfig}
          footerConfig={editFooterConfig}
          onHeaderChange={setEditHeaderConfig}
          onFooterChange={setEditFooterConfig}
        />
      )}

      {/* Placeholder Reference */}
      <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1 bg-teal-50 rounded">
            <Hash className="w-3.5 h-3.5 text-teal-600" />
          </div>
          <h3 className="font-semibold text-[#5e5873] text-sm">
            Segnaposto Disponibili
          </h3>
        </div>
        <div className="grid grid-cols-4 gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{company.legal_name}}"}
            </span>{" "}
            — Ragione Sociale
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{company.vat_number}}"}
            </span>{" "}
            — P.IVA Emittente
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{company.address_line1}}"}
            </span>{" "}
            — Indirizzo
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{company.logo_url}}"}
            </span>{" "}
            — URL Logo
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{customer.company_name}}"}
            </span>{" "}
            — Cliente
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{customer.vat_number}}"}
            </span>{" "}
            — P.IVA Cliente
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{customer.billing_address.city}}"}
            </span>{" "}
            — Citt\u00e0
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{customer.pec_email}}"}
            </span>{" "}
            — PEC Cliente
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{document.document_number}}"}
            </span>{" "}
            — Numero Doc.
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{document.date}}"}
            </span>{" "}
            — Data
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{document.type_label}}"}
            </span>{" "}
            — Tipo
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{document.due_date}}"}
            </span>{" "}
            — Scadenza
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">{"{{items}}"}</span> —
            Righe (tabella HTML)
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{totals.total}}"}
            </span>{" "}
            — Totale
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{totals.subtotal_net}}"}
            </span>{" "}
            — Imponibile
          </div>
          <div>
            <span className="font-mono text-[#5e5873]">
              {"{{vat_breakdown}}"}
            </span>{" "}
            — Riepilogo IVA
          </div>
          <div className="col-span-2 mt-1 pt-1 border-t border-[#ebe9f1]">
            <span className="font-mono text-[#009688]">
              {"{{header}}"}
            </span>{" "}
            — Header auto-generato (da config)
          </div>
          <div className="col-span-2 mt-1 pt-1 border-t border-[#ebe9f1]">
            <span className="font-mono text-[#009688]">
              {"{{footer}}"}
            </span>{" "}
            — Footer auto-generato (da config)
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Header & Footer Configuration Panel
// ============================================

function HeaderFooterConfig({
  headerConfig,
  footerConfig,
  onHeaderChange,
  onFooterChange,
}: {
  headerConfig: TemplateHeaderConfig;
  footerConfig: TemplateFooterConfig;
  onHeaderChange: (config: TemplateHeaderConfig) => void;
  onFooterChange: (config: TemplateFooterConfig) => void;
}) {
  const logoPositionIcons: Record<string, React.ReactNode> = {
    left: <AlignLeft className="w-4 h-4" />,
    center: <AlignCenter className="w-4 h-4" />,
    right: <AlignRight className="w-4 h-4" />,
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Header Config */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-3 bg-[#f8f8f8] border-b border-[#ebe9f1] flex items-center gap-2">
          <Type className="w-4 h-4 text-[#5e5873]" />
          <span className="text-sm font-medium text-[#5e5873]">
            Configurazione Header
          </span>
        </div>
        <div className="p-4 space-y-4">
          {/* Header Style */}
          <div>
            <label className="block text-xs font-medium text-[#5e5873] mb-2">
              Stile Header
            </label>
            <div className="grid grid-cols-2 gap-2">
              {HEADER_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() =>
                    onHeaderChange({ ...headerConfig, style })
                  }
                  className={`px-3 py-2 text-xs rounded-lg border transition-colors text-left ${
                    headerConfig.style === style
                      ? "border-[#009688] bg-[#e0f2f1] text-[#009688] font-medium"
                      : "border-[#ebe9f1] hover:bg-[#f8f8f8] text-[#5e5873]"
                  }`}
                >
                  {HEADER_STYLE_LABELS[style]}
                </button>
              ))}
            </div>
          </div>

          {/* Show Logo */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-[#5e5873]">Mostra Logo</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={headerConfig.show_logo}
                onChange={(e) =>
                  onHeaderChange({
                    ...headerConfig,
                    show_logo: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]" />
            </label>
          </div>

          {/* Logo Position */}
          {headerConfig.show_logo && (
            <div>
              <label className="block text-xs font-medium text-[#5e5873] mb-2">
                Posizione Logo
              </label>
              <div className="flex gap-2">
                {LOGO_POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    onClick={() =>
                      onHeaderChange({
                        ...headerConfig,
                        logo_position: pos,
                      })
                    }
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      headerConfig.logo_position === pos
                        ? "border-[#009688] bg-[#e0f2f1] text-[#009688]"
                        : "border-[#ebe9f1] hover:bg-[#f8f8f8] text-[#5e5873]"
                    }`}
                  >
                    {logoPositionIcons[pos]}
                    {LOGO_POSITION_LABELS[pos]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Show Company Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-[#5e5873]">Info Azienda</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={headerConfig.show_company_info}
                onChange={(e) =>
                  onHeaderChange({
                    ...headerConfig,
                    show_company_info: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]" />
            </label>
          </div>

          {/* Header Preview */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Anteprima</p>
            <HeaderPreview config={headerConfig} />
          </div>
        </div>
      </div>

      {/* Footer Config */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-3 bg-[#f8f8f8] border-b border-[#ebe9f1] flex items-center gap-2">
          <AlignLeft className="w-4 h-4 text-[#5e5873]" />
          <span className="text-sm font-medium text-[#5e5873]">
            Configurazione Footer
          </span>
        </div>
        <div className="p-4 space-y-4">
          {/* Enable Footer */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#5e5873]">
              Footer Attivo
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={footerConfig.enabled}
                onChange={(e) =>
                  onFooterChange({
                    ...footerConfig,
                    enabled: e.target.checked,
                  })
                }
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]" />
            </label>
          </div>

          {footerConfig.enabled && (
            <>
              {/* Show Notes */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5e5873]">Mostra Note</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={footerConfig.show_notes}
                    onChange={(e) =>
                      onFooterChange({
                        ...footerConfig,
                        show_notes: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]" />
                </label>
              </div>

              {/* Show Page Numbers */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#5e5873]">
                  Numeri di Pagina
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={footerConfig.show_page_numbers}
                    onChange={(e) =>
                      onFooterChange({
                        ...footerConfig,
                        show_page_numbers: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#009688]" />
                </label>
              </div>

              {/* Custom Text */}
              <div>
                <label className="block text-xs font-medium text-[#5e5873] mb-1">
                  Testo Personalizzato
                </label>
                <textarea
                  value={footerConfig.custom_text || ""}
                  onChange={(e) =>
                    onFooterChange({
                      ...footerConfig,
                      custom_text: e.target.value || undefined,
                    })
                  }
                  placeholder="Es. Documento informatico ai sensi..."
                  className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm resize-none"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Footer Preview */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">Anteprima</p>
            <FooterPreview config={footerConfig} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Mini Previews
// ============================================

function HeaderPreview({ config }: { config: TemplateHeaderConfig }) {
  if (config.style === "minimal") {
    return (
      <div className="text-[10px]">
        <div className="font-bold">Azienda S.r.l.</div>
        <div className="border-t border-gray-300 mt-1" />
      </div>
    );
  }
  if (config.style === "centered") {
    return (
      <div className="text-center text-[10px]">
        {config.show_logo && <div className="w-6 h-3 bg-gray-300 rounded mx-auto mb-1" />}
        <div className="font-bold">Azienda S.r.l.</div>
        {config.show_company_info && <div className="text-gray-400">Via Roma 1, Milano</div>}
        <div className="mt-1 font-semibold">FATTURA INV-2026-001</div>
      </div>
    );
  }
  if (config.style === "banner") {
    return (
      <div className="bg-[#009688] text-white text-[10px] px-2 py-1 rounded flex justify-between items-center">
        <div className="flex items-center gap-1">
          {config.show_logo && <div className="w-4 h-2 bg-white/30 rounded" />}
          <span className="font-bold">Azienda S.r.l.</span>
        </div>
        <span className="font-semibold">FATTURA</span>
      </div>
    );
  }
  // standard
  return (
    <div className="flex justify-between text-[10px]">
      <div style={{ order: config.logo_position === "right" ? 2 : 1 }}>
        {config.show_logo && <div className="w-8 h-3 bg-gray-300 rounded mb-1" />}
        <div className="font-bold">Azienda S.r.l.</div>
        {config.show_company_info && <div className="text-gray-400">Via Roma 1 · P.IVA 01234...</div>}
      </div>
      <div className="text-right" style={{ order: config.logo_position === "right" ? 1 : 2 }}>
        <div className="font-bold text-[11px]">FATTURA</div>
        <div className="text-gray-400">INV-2026-001</div>
      </div>
    </div>
  );
}

function FooterPreview({ config }: { config: TemplateFooterConfig }) {
  if (!config.enabled) {
    return (
      <div className="text-[10px] text-gray-400 italic text-center">
        Footer disabilitato
      </div>
    );
  }
  return (
    <div className="text-[10px] border-t border-gray-200 pt-1">
      {config.show_notes && (
        <div className="text-gray-500">Note: Pagamento tramite bonifico bancario...</div>
      )}
      {config.custom_text && (
        <div className="text-gray-400 mt-0.5">{config.custom_text.substring(0, 60)}...</div>
      )}
      {config.show_page_numbers && (
        <div className="text-gray-400 text-right mt-0.5">
          Azienda S.r.l. · P.IVA 01234...
        </div>
      )}
    </div>
  );
}
