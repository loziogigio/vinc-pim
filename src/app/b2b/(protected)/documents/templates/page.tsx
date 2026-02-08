"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Layout,
  Plus,
  Loader2,
  Star,
  Lock,
  Trash2,
  Copy,
  Sparkles,
  FileText,
  Eye,
  EyeOff,
  Type,
  AlignLeft,
} from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  HEADER_STYLE_LABELS,
} from "@/lib/constants/document";
import type { HeaderStyle } from "@/lib/constants/document";

interface TemplateItem {
  template_id: string;
  name: string;
  description?: string;
  document_type: string;
  page_size: string;
  orientation: string;
  header_config?: {
    show_logo: boolean;
    logo_position: string;
    show_company_info: boolean;
    style: string;
  };
  footer_config?: {
    enabled: boolean;
    show_notes: boolean;
    show_page_numbers: boolean;
    custom_text?: string;
  };
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export default function DocumentTemplatesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDocType, setNewDocType] = useState("all");

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/b2b/documents/templates");
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error("Failed to fetch templates:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const systemTemplates = templates.filter((t) => t.is_system);
  const customTemplates = templates.filter((t) => !t.is_system);

  const handleCreate = async () => {
    if (!newName.trim()) {
      alert("Inserisci un nome per il template");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch("/api/b2b/documents/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription || undefined,
          document_type: newDocType,
          html_template: DEFAULT_HTML_TEMPLATE,
          css_styles: DEFAULT_CSS,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(
          `${tenantPrefix}/b2b/documents/templates/${data.template.template_id}`,
        );
      } else {
        alert(data.error || "Errore nella creazione");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch("/api/b2b/documents/templates/seed", {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        await fetchTemplates();
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsSeeding(false);
    }
  };

  const handleDuplicate = async (templateId: string) => {
    setDuplicatingId(templateId);
    try {
      const res = await fetch(
        `/api/b2b/documents/templates/${templateId}/duplicate`,
        { method: "POST" },
      );
      const data = await res.json();
      if (data.success) {
        router.push(
          `${tenantPrefix}/b2b/documents/templates/${data.template.template_id}`,
        );
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Eliminare questo template?")) return;
    try {
      const res = await fetch(
        `/api/b2b/documents/templates/${templateId}`,
        { method: "DELETE" },
      );
      const data = await res.json();
      if (data.success) {
        setTemplates(templates.filter((t) => t.template_id !== templateId));
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873]">Template Documenti</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gestisci i template per fatture, preventivi e altri documenti
          </p>
        </div>
        <div className="flex items-center gap-2">
          {systemTemplates.length === 0 && (
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#009688] text-[#009688] rounded-lg hover:bg-[#e0f2f1] text-sm font-medium disabled:opacity-50"
            >
              {isSeeding ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              Inizializza Template Standard
            </button>
          )}
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Nuovo Template
          </button>
        </div>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4 space-y-3">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Nome
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Es. Template Personalizzato"
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Tipo Documento
              </label>
              <select
                value={newDocType}
                onChange={(e) => setNewDocType(e.target.value)}
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
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
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Descrizione
              </label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Opzionale..."
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium disabled:opacity-50"
            >
              {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
              Crea Template
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8]"
            >
              Annulla
            </button>
          </div>
        </div>
      )}

      {/* System Templates Section */}
      {systemTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide">
              Template Standard
            </h2>
            <span className="text-xs text-muted-foreground">
              ({systemTemplates.length} template di sistema)
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {systemTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.template_id}
                template={tpl}
                tenantPrefix={tenantPrefix}
                onNavigate={(id) =>
                  router.push(`${tenantPrefix}/b2b/documents/templates/${id}`)
                }
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                isDuplicating={duplicatingId === tpl.template_id}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom Templates Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-teal-50 rounded-lg">
            <FileText className="w-4 h-4 text-teal-600" />
          </div>
          <h2 className="text-sm font-semibold text-[#5e5873] uppercase tracking-wide">
            Template Personalizzati
          </h2>
          <span className="text-xs text-muted-foreground">
            ({customTemplates.length})
          </span>
        </div>
        {customTemplates.length === 0 ? (
          <div className="bg-white rounded-lg border border-dashed border-[#d5d5d5] p-8 text-center">
            <Layout className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-1">
              Nessun template personalizzato
            </p>
            <p className="text-xs text-muted-foreground">
              Crea un nuovo template o duplica uno standard per personalizzarlo
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {customTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.template_id}
                template={tpl}
                tenantPrefix={tenantPrefix}
                onNavigate={(id) =>
                  router.push(`${tenantPrefix}/b2b/documents/templates/${id}`)
                }
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                isDuplicating={duplicatingId === tpl.template_id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Empty state when no templates at all */}
      {templates.length === 0 && (
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-12 text-center">
          <Layout className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#5e5873] mb-2">
            Nessun template
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Inizializza i template standard per iniziare, oppure crea un template personalizzato.
          </p>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium disabled:opacity-50"
          >
            {isSeeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            Inizializza Template Standard
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Template Card Component
// ============================================

function TemplateCard({
  template: tpl,
  onNavigate,
  onDuplicate,
  onDelete,
  isDuplicating,
}: {
  template: TemplateItem;
  tenantPrefix: string;
  onNavigate: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  isDuplicating: boolean;
}) {
  const headerStyle = tpl.header_config?.style as HeaderStyle | undefined;
  const footerEnabled = tpl.footer_config?.enabled !== false;

  return (
    <div
      className="bg-white rounded-lg border border-[#ebe9f1] hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onNavigate(tpl.template_id)}
    >
      {/* Preview thumbnail */}
      <div className="h-28 bg-gradient-to-b from-gray-50 to-gray-100 rounded-t-lg flex items-center justify-center relative overflow-hidden">
        <div className="w-16 h-20 bg-white rounded shadow-sm border border-gray-200 flex flex-col items-center justify-center p-1.5">
          <div className="w-full h-1 bg-gray-300 rounded mb-1" />
          <div className="w-full h-0.5 bg-gray-200 rounded mb-0.5" />
          <div className="w-3/4 h-0.5 bg-gray-200 rounded mb-1.5" />
          <div className="w-full space-y-0.5">
            <div className="h-0.5 bg-gray-150 rounded" style={{ backgroundColor: "#e5e7eb" }} />
            <div className="h-0.5 bg-gray-150 rounded" style={{ backgroundColor: "#e5e7eb" }} />
            <div className="h-0.5 bg-gray-150 rounded" style={{ backgroundColor: "#e5e7eb" }} />
          </div>
          <div className="w-full h-0.5 bg-gray-200 rounded mt-auto" />
        </div>
        {tpl.is_default && (
          <div className="absolute top-2 right-2">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
          </div>
        )}
        {tpl.is_system && (
          <div className="absolute top-2 left-2">
            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <h3 className="font-semibold text-[#5e5873] text-sm truncate">
            {tpl.name}
          </h3>
        </div>
        {tpl.description && (
          <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
            {tpl.description}
          </p>
        )}

        {/* Config badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {headerStyle && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
              <Type className="w-2.5 h-2.5" />
              {HEADER_STYLE_LABELS[headerStyle] || headerStyle}
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded">
            {footerEnabled ? (
              <><Eye className="w-2.5 h-2.5" /> Footer</>
            ) : (
              <><EyeOff className="w-2.5 h-2.5" /> No footer</>
            )}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-gray-50 text-gray-600 rounded">
            <AlignLeft className="w-2.5 h-2.5" />
            {tpl.page_size}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {tpl.document_type === "all"
              ? "Tutti i tipi"
              : DOCUMENT_TYPE_LABELS[
                  tpl.document_type as keyof typeof DOCUMENT_TYPE_LABELS
                ] || tpl.document_type}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="px-3 py-2 border-t border-[#ebe9f1] flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {new Date(tpl.updated_at).toLocaleDateString("it-IT")}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(tpl.template_id);
            }}
            disabled={isDuplicating}
            className="p-1 text-[#009688] hover:text-[#00796b] rounded hover:bg-teal-50 transition-colors"
            title="Duplica template"
          >
            {isDuplicating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
          {!tpl.is_system && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(tpl.template_id);
              }}
              className="p-1 text-red-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
              title="Elimina template"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================
// Default template for new custom templates
// ============================================

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  {{header}}

  <div class="customer">
    <h3>Spett.le</h3>
    <p>{{customer.company_name}}</p>
    <p>{{customer.billing_address.street_address}}</p>
    <p>{{customer.billing_address.postal_code}} {{customer.billing_address.city}}</p>
    <p>P.IVA: {{customer.vat_number}}</p>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th>Descrizione</th>
        <th>Qt\u00e0</th>
        <th>Prezzo Unit.</th>
        <th>IVA</th>
        <th>Totale</th>
      </tr>
    </thead>
    <tbody>
      {{items}}
    </tbody>
  </table>

  <div class="totals">
    <p>Imponibile: {{totals.subtotal_net}}</p>
    {{vat_breakdown}}
    <p><strong>Totale: {{totals.total}}</strong></p>
  </div>

  {{footer}}
</body>
</html>`;

const DEFAULT_CSS = `body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
.customer { margin: 20px 0; padding: 10px; background: #f5f5f5; }
.items { width: 100%; border-collapse: collapse; margin: 20px 0; }
.items th, .items td { border: 1px solid #ddd; padding: 8px; text-align: left; }
.items th { background: #f5f5f5; font-weight: bold; }
.totals { text-align: right; margin: 20px 0; }`;
