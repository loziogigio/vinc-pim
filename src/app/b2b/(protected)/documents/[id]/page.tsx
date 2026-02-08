"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Send,
  Copy,
  Lock,
  Ban,
  CheckCircle,
  Loader2,
  Save,
  Plus,
  Trash2,
  Clock,
  Search,
} from "lucide-react";
import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_STATUS_LABELS,
  PAYMENT_TERMS,
  PAYMENT_TERMS_LABELS,
  canEditDocument,
  getAllowedDocumentTransitions,
} from "@/lib/constants/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import { DocumentStatusBadge } from "@/components/documents";
import {
  calculateDocumentLineTotals,
  calculateDocumentTotals,
  getNextDocumentLineNumber,
} from "@/lib/types/document";
import type { DocumentLineItem, Document } from "@/lib/types/document";

interface CustomerResult {
  customer_id: string;
  company_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  legal_info?: { vat_number?: string };
}

export default function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const tenantPrefix =
    pathname?.match(/^\/([^/]+)\/b2b/)?.[0]?.replace(/\/b2b$/, "") || "";

  const [documentId, setDocumentId] = useState("");
  const [doc, setDoc] = useState<Document | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  // Edit state (for drafts)
  const [editItems, setEditItems] = useState<DocumentLineItem[]>([]);
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Customer editing (for drafts)
  const [editingCustomer, setEditingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  // Send modal
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendEmail, setSendEmail] = useState("");
  const [sendSubject, setSendSubject] = useState("");
  const [sendMessage, setSendMessage] = useState("");

  useEffect(() => {
    params.then(({ id }) => setDocumentId(id));
  }, [params]);

  const fetchDocument = useCallback(async () => {
    if (!documentId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`);
      const data = await res.json();
      if (data.success && data.document) {
        const d = data.document as Document;
        setDoc(d);
        setEditItems(d.items || []);
        setEditPaymentTerms(d.payment_terms || "");
        setEditNotes(d.notes || "");
        setEditInternalNotes(d.internal_notes || "");
        setHasChanges(false);
        // Pre-fill send email from customer
        if (d.customer?.email) {
          setSendEmail(d.customer.email);
        }
      }
    } catch (err) {
      console.error("Failed to fetch document:", err);
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  const isDraft = doc?.status === "draft";
  const allowedTransitions = doc
    ? getAllowedDocumentTransitions(doc.status as DocumentStatus)
    : [];

  // Line item editing
  const addItem = () => {
    const lineNumber = getNextDocumentLineNumber(editItems);
    setEditItems([
      ...editItems,
      {
        line_number: lineNumber,
        description: "",
        quantity: 1,
        unit_price: 0,
        vat_rate: 22,
        line_net: 0,
        line_vat: 0,
        line_total: 0,
      },
    ]);
    setHasChanges(true);
  };

  const updateItem = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    const updated = [...editItems];
    (updated[index] as any)[field] = value;
    const item = updated[index];
    const totals = calculateDocumentLineTotals(
      item.quantity,
      item.unit_price,
      item.vat_rate,
      item.discount_percent,
    );
    updated[index] = { ...item, ...totals };
    setEditItems(updated);
    setHasChanges(true);
  };

  const removeItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const editTotals = calculateDocumentTotals(editItems);

  // Customer search
  const searchCustomers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setCustomerResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/b2b/documents/customers/search?q=${encodeURIComponent(q)}`,
      );
      const data = await res.json();
      setCustomerResults(data.customers || []);
      setShowCustomerDropdown(true);
    } catch {
      /* ignore */
    } finally {
      setIsSearching(false);
    }
  }, []);

  const selectCustomer = async (c: CustomerResult) => {
    setShowCustomerDropdown(false);
    setEditingCustomer(false);
    setCustomerSearch("");
    // Save customer change immediately
    if (!doc) return;
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_id: c.customer_id }),
      });
      const data = await res.json();
      if (data.success) {
        setDoc(data.document);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Save draft changes
  const handleSave = async () => {
    if (!doc || !isDraft) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: editItems,
          payment_terms: editPaymentTerms || undefined,
          notes: editNotes || undefined,
          internal_notes: editInternalNotes || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDoc(data.document);
        setHasChanges(false);
      } else {
        alert(data.error || "Errore nel salvataggio");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setIsSaving(false);
    }
  };

  // Lifecycle actions
  const handleFinalize = async () => {
    if (!confirm("Sei sicuro di voler finalizzare? Il documento non sarà più modificabile.")) return;
    setActionLoading("finalize");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/finalize`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setDoc(data.document);
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleSend = async () => {
    if (!sendEmail) return;
    setActionLoading("send");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient_email: sendEmail,
          subject: sendSubject || undefined,
          message: sendMessage || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowSendModal(false);
        fetchDocument();
      } else {
        alert(data.error || "Errore invio");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleMarkPaid = async () => {
    setActionLoading("paid");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/mark-paid`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) setDoc(data.document);
      else alert(data.error || "Errore");
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleVoid = async () => {
    if (!confirm("Sei sicuro di voler annullare questo documento?")) return;
    setActionLoading("void");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) setDoc(data.document);
      else alert(data.error || "Errore");
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleDuplicate = async () => {
    setActionLoading("duplicate");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        router.push(
          `${tenantPrefix}/b2b/documents/${data.document.document_id}`,
        );
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleDownloadPdf = async () => {
    setActionLoading("pdf");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}/pdf`);
      if (!res.ok) {
        alert("Errore generazione PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        `${doc?.document_number || doc?.document_id || "document"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Eliminare questa bozza? L'azione è irreversibile.")) return;
    setActionLoading("delete");
    try {
      const res = await fetch(`/api/b2b/documents/${documentId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        router.push(`${tenantPrefix}/b2b/documents/list`);
      } else {
        alert(data.error || "Errore");
      }
    } catch {
      alert("Errore di rete");
    } finally {
      setActionLoading("");
    }
  };

  const formatCurrency = (n: number, currency: string = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Documento non trovato.
      </div>
    );
  }

  const customerName =
    doc.customer?.company_name ||
    [doc.customer?.first_name, doc.customer?.last_name]
      .filter(Boolean)
      .join(" ") ||
    "—";

  const displayItems = isDraft ? editItems : doc.items || [];
  const displayTotals = isDraft ? editTotals : doc.totals;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push(`${tenantPrefix}/b2b/documents/list`)}
            className="p-2 rounded-lg hover:bg-[#f8f8f8]"
          >
            <ArrowLeft className="w-5 h-5 text-[#5e5873]" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[#5e5873]">
                {doc.document_number || (
                  <span className="text-muted-foreground italic">Bozza</span>
                )}
              </h1>
              <DocumentStatusBadge status={doc.status as DocumentStatus} />
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {DOCUMENT_TYPE_LABELS[doc.document_type as DocumentType]} —{" "}
              {new Date(doc.created_at).toLocaleDateString("it-IT")}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isDraft && hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#009688] text-white rounded-lg hover:bg-[#00796b] text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Salva
            </button>
          )}

          {isDraft && allowedTransitions.includes("finalized") && (
            <button
              onClick={handleFinalize}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === "finalize" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              Finalizza
            </button>
          )}

          {allowedTransitions.includes("sent") && (
            <button
              onClick={() => setShowSendModal(true)}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              Invia
            </button>
          )}

          {allowedTransitions.includes("paid") && (
            <button
              onClick={handleMarkPaid}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === "paid" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Segna Pagato
            </button>
          )}

          {!isDraft && (
            <button
              onClick={handleDownloadPdf}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === "pdf" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              PDF
            </button>
          )}

          <button
            onClick={handleDuplicate}
            disabled={!!actionLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 border border-[#ebe9f1] rounded-lg hover:bg-[#f8f8f8] text-sm font-medium disabled:opacity-50"
          >
            {actionLoading === "duplicate" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            Duplica
          </button>

          {allowedTransitions.includes("voided") && (
            <button
              onClick={handleVoid}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
            >
              {actionLoading === "void" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              Annulla
            </button>
          )}

          {isDraft && (
            <button
              onClick={handleDelete}
              disabled={!!actionLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-medium disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Elimina
            </button>
          )}
        </div>
      </div>

      {/* Company & Customer Info */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
          <h3 className="font-semibold text-[#5e5873] mb-2">Emittente</h3>
          <div className="text-sm space-y-0.5">
            <div className="font-medium">{doc.company?.legal_name}</div>
            {doc.company?.address_line1 && (
              <div className="text-muted-foreground">
                {doc.company.address_line1}
              </div>
            )}
            {doc.company?.vat_number && (
              <div className="text-muted-foreground">
                P.IVA: {doc.company.vat_number}
              </div>
            )}
            {doc.company?.pec_email && (
              <div className="text-muted-foreground">
                PEC: {doc.company.pec_email}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-[#5e5873]">Cliente</h3>
            {isDraft && !editingCustomer && (
              <button
                onClick={() => setEditingCustomer(true)}
                className="text-xs text-[#009688] hover:underline"
              >
                Cambia
              </button>
            )}
          </div>

          {editingCustomer ? (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Cerca cliente..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    searchCustomers(e.target.value);
                  }}
                  onFocus={() =>
                    customerResults.length > 0 &&
                    setShowCustomerDropdown(true)
                  }
                  onBlur={() =>
                    setTimeout(() => setShowCustomerDropdown(false), 200)
                  }
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#009688]/20"
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-white border border-[#ebe9f1] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {customerResults.map((c) => (
                    <button
                      key={c.customer_id}
                      onMouseDown={() => selectCustomer(c)}
                      className="w-full text-left px-3 py-2 hover:bg-[#f8f8f8] text-sm"
                    >
                      <div className="font-medium text-[#5e5873]">
                        {c.company_name ||
                          [c.first_name, c.last_name]
                            .filter(Boolean)
                            .join(" ")}
                      </div>
                      {c.legal_info?.vat_number && (
                        <div className="text-xs text-muted-foreground">
                          P.IVA: {c.legal_info.vat_number}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button
                onClick={() => {
                  setEditingCustomer(false);
                  setCustomerSearch("");
                }}
                className="mt-2 text-xs text-muted-foreground hover:underline"
              >
                Annulla
              </button>
            </div>
          ) : (
            <div className="text-sm space-y-0.5">
              <div className="font-medium">{customerName}</div>
              {doc.customer?.vat_number && (
                <div className="text-muted-foreground">
                  P.IVA: {doc.customer.vat_number}
                </div>
              )}
              {doc.customer?.email && (
                <div className="text-muted-foreground">
                  {doc.customer.email}
                </div>
              )}
              {doc.customer?.pec_email && (
                <div className="text-muted-foreground">
                  PEC: {doc.customer.pec_email}
                </div>
              )}
              {doc.customer?.billing_address && (
                <div className="text-muted-foreground">
                  {doc.customer.billing_address.street_address},{" "}
                  {doc.customer.billing_address.postal_code}{" "}
                  {doc.customer.billing_address.city} (
                  {doc.customer.billing_address.province})
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Payment & metadata */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
          <div className="text-xs text-muted-foreground mb-1">
            Termini di Pagamento
          </div>
          {isDraft ? (
            <select
              value={editPaymentTerms}
              onChange={(e) => {
                setEditPaymentTerms(e.target.value);
                setHasChanges(true);
              }}
              className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
            >
              <option value="">—</option>
              {PAYMENT_TERMS.map((t) => (
                <option key={t} value={t}>
                  {PAYMENT_TERMS_LABELS[t]}
                </option>
              ))}
            </select>
          ) : (
            <div className="font-medium text-sm">
              {doc.payment_terms
                ? PAYMENT_TERMS_LABELS[
                    doc.payment_terms as keyof typeof PAYMENT_TERMS_LABELS
                  ] || doc.payment_terms
                : "—"}
            </div>
          )}
        </div>
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
          <div className="text-xs text-muted-foreground mb-1">Valuta</div>
          <div className="font-medium text-sm">{doc.currency || "EUR"}</div>
        </div>
        <div className="bg-white rounded-lg border border-[#ebe9f1] p-4">
          <div className="text-xs text-muted-foreground mb-1">Ultimo Invio</div>
          <div className="font-medium text-sm">
            {doc.last_sent_at
              ? new Date(doc.last_sent_at).toLocaleDateString("it-IT", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg border border-[#ebe9f1]">
        <div className="p-4 border-b border-[#ebe9f1] flex items-center justify-between">
          <h2 className="font-semibold text-[#5e5873]">Righe Documento</h2>
          {isDraft && (
            <button
              onClick={addItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[#009688] text-white rounded-lg hover:bg-[#00796b] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Aggiungi Riga
            </button>
          )}
        </div>

        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            Nessuna riga.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#ebe9f1] bg-[#f8f8f8]">
                <th className="text-left px-3 py-2 font-medium text-[#5e5873]">
                  Descrizione
                </th>
                <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-20">
                  Qtà
                </th>
                <th className="text-right px-3 py-2 font-medium text-[#5e5873] w-28">
                  Prezzo Unit.
                </th>
                <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-20">
                  IVA %
                </th>
                <th className="text-center px-3 py-2 font-medium text-[#5e5873] w-20">
                  Sconto %
                </th>
                <th className="text-right px-3 py-2 font-medium text-[#5e5873] w-28">
                  Totale
                </th>
                {isDraft && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((item, idx) => (
                <tr
                  key={item.line_number}
                  className="border-b border-[#ebe9f1]"
                >
                  <td className="px-3 py-2">
                    {isDraft ? (
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateItem(idx, "description", e.target.value)
                        }
                        placeholder="Descrizione..."
                        className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm"
                      />
                    ) : (
                      <span>{item.description}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isDraft ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantity}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          const n = parseFloat(v);
                          if (!isNaN(n)) updateItem(idx, "quantity", n);
                        }}
                        className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                      />
                    ) : (
                      <span>{item.quantity}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {isDraft ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.unit_price}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          const n = parseFloat(v);
                          if (!isNaN(n)) updateItem(idx, "unit_price", n);
                        }}
                        className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-right"
                      />
                    ) : (
                      <span>{formatCurrency(item.unit_price, doc.currency)}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isDraft ? (
                      <select
                        value={item.vat_rate}
                        onChange={(e) =>
                          updateItem(idx, "vat_rate", parseInt(e.target.value))
                        }
                        className="w-full px-1 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                      >
                        <option value={22}>22%</option>
                        <option value={10}>10%</option>
                        <option value={4}>4%</option>
                        <option value={0}>0%</option>
                      </select>
                    ) : (
                      <span>{item.vat_rate}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {isDraft ? (
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.discount_percent || ""}
                        onChange={(e) => {
                          const v = e.target.value.replace(",", ".");
                          const n = parseFloat(v);
                          updateItem(
                            idx,
                            "discount_percent",
                            isNaN(n) ? 0 : n,
                          );
                        }}
                        placeholder="0"
                        className="w-full px-2 py-1 border border-[#ebe9f1] rounded text-sm text-center"
                      />
                    ) : (
                      <span>{item.discount_percent || 0}%</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-medium">
                    {formatCurrency(item.line_total, doc.currency)}
                  </td>
                  {isDraft && (
                    <td className="px-1 py-2">
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1 text-red-400 hover:text-red-600 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        {displayItems.length > 0 && displayTotals && (
          <div className="flex justify-end p-4 border-t border-[#ebe9f1]">
            <div className="w-72 space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Imponibile</span>
                <span>
                  {formatCurrency(displayTotals.subtotal_net, doc.currency)}
                </span>
              </div>
              {displayTotals.vat_breakdown?.map(
                (v: { rate: number; vat: number }) => (
                  <div key={v.rate} className="flex justify-between">
                    <span className="text-muted-foreground">
                      IVA {v.rate}%
                    </span>
                    <span>{formatCurrency(v.vat, doc.currency)}</span>
                  </div>
                ),
              )}
              <div className="flex justify-between font-bold text-base border-t border-[#ebe9f1] pt-2 mt-2">
                <span>Totale</span>
                <span>
                  {formatCurrency(displayTotals.total, doc.currency)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1">
            Note
          </label>
          {isDraft ? (
            <textarea
              value={editNotes}
              onChange={(e) => {
                setEditNotes(e.target.value);
                setHasChanges(true);
              }}
              rows={3}
              className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none resize-none"
            />
          ) : (
            <div className="bg-white rounded-lg border border-[#ebe9f1] p-3 text-sm min-h-[60px] text-muted-foreground">
              {doc.notes || "—"}
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-[#5e5873] mb-1">
            Note Interne
          </label>
          {isDraft ? (
            <textarea
              value={editInternalNotes}
              onChange={(e) => {
                setEditInternalNotes(e.target.value);
                setHasChanges(true);
              }}
              rows={3}
              className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm focus:outline-none resize-none"
            />
          ) : (
            <div className="bg-white rounded-lg border border-[#ebe9f1] p-3 text-sm min-h-[60px] text-muted-foreground">
              {doc.internal_notes || "—"}
            </div>
          )}
        </div>
      </div>

      {/* History */}
      {doc.history && doc.history.length > 0 && (
        <div className="bg-white rounded-lg border border-[#ebe9f1]">
          <div className="p-4 border-b border-[#ebe9f1]">
            <h2 className="font-semibold text-[#5e5873]">
              Cronologia
            </h2>
          </div>
          <div className="divide-y divide-[#ebe9f1]">
            {[...doc.history].reverse().map((entry, idx) => (
              <div
                key={idx}
                className="px-4 py-3 flex items-start gap-3"
              >
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-[#5e5873]">
                    <span className="font-medium capitalize">
                      {DOCUMENT_STATUS_LABELS[
                        entry.action as DocumentStatus
                      ] || entry.action}
                    </span>
                    {entry.performed_by_name && (
                      <span className="text-muted-foreground">
                        {" "}
                        da {entry.performed_by_name}
                      </span>
                    )}
                  </div>
                  {entry.details && (
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {entry.details}
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground shrink-0">
                  {new Date(entry.performed_at).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Modal */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-[#5e5873]">
              Invia Documento
            </h3>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Email Destinatario
              </label>
              <input
                type="email"
                value={sendEmail}
                onChange={(e) => setSendEmail(e.target.value)}
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
                placeholder="email@esempio.it"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Oggetto (opzionale)
              </label>
              <input
                type="text"
                value={sendSubject}
                onChange={(e) => setSendSubject(e.target.value)}
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#5e5873] mb-1">
                Messaggio (opzionale)
              </label>
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#ebe9f1] rounded-lg text-sm resize-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSendModal(false)}
                className="px-4 py-2 border border-[#ebe9f1] rounded-lg text-sm hover:bg-[#f8f8f8]"
              >
                Annulla
              </button>
              <button
                onClick={handleSend}
                disabled={!sendEmail || actionLoading === "send"}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm font-medium disabled:opacity-50"
              >
                {actionLoading === "send" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Invia Email
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
