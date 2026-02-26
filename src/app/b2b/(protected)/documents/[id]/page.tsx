"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getAllowedDocumentTransitions } from "@/lib/constants/document";
import type { DocumentStatus } from "@/lib/constants/document";
import {
  DocumentHeader,
  DocumentActionButtons,
  DocumentPartiesInfo,
  DocumentPaymentInfo,
  DocumentLineItems,
  DocumentNotes,
  DocumentHistory,
  SendDocumentModal,
} from "@/components/documents";
import { useDocumentActions } from "@/components/documents/useDocumentActions";
import {
  calculateDocumentLineTotals,
  calculateDocumentTotals,
  getNextDocumentLineNumber,
} from "@/lib/types/document";
import type { DocumentLineItem, Document } from "@/lib/types/document";

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

  // Edit state (for drafts)
  const [editItems, setEditItems] = useState<DocumentLineItem[]>([]);
  const [editPaymentTerms, setEditPaymentTerms] = useState("");
  const [editCustomDays, setEditCustomDays] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editInternalNotes, setEditInternalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

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
        if (d.payment_terms === "custom_date" && d.due_date) {
          setEditDueDate(new Date(d.due_date).toISOString().split("T")[0]);
          setEditCustomDays("");
        } else if (d.payment_terms === "custom_days" && d.due_date) {
          const diffMs =
            new Date(d.due_date).getTime() - new Date(d.created_at).getTime();
          const days = Math.max(1, Math.round(diffMs / 86400000));
          setEditCustomDays(String(days));
          setEditDueDate("");
        } else {
          setEditCustomDays("");
          setEditDueDate("");
        }
        setEditNotes(d.notes || "");
        setEditInternalNotes(d.internal_notes || "");
        setHasChanges(false);
        if (d.customer?.email) setSendEmail(d.customer.email);
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

  const {
    actionLoading,
    handleFinalize,
    handleSend,
    handleMarkPaid,
    handleVoid,
    handleDuplicate,
    handleConvert,
    handleDownloadPdf,
    handleDelete,
    handleMarkSentManually,
    handleUpdateNumber,
  } = useDocumentActions({ documentId, doc, tenantPrefix, fetchDocument });

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

  const updateItem = (index: number, field: string, value: string | number) => {
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

  const formatCurrency = (n: number, currency: string = "EUR") =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency }).format(n);

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
          due_date:
            editPaymentTerms === "custom_date" && editDueDate
              ? editDueDate
              : editPaymentTerms === "custom_days" && editCustomDays
                ? new Date(
                    Date.now() + parseInt(editCustomDays) * 86400000,
                  ).toISOString()
                : undefined,
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

  // Wrap action handlers that return documents to update local state
  const onFinalize = async () => {
    const d = await handleFinalize();
    if (d) setDoc(d);
  };
  const onMarkPaid = async () => {
    const d = await handleMarkPaid();
    if (d) setDoc(d);
  };
  const onVoid = async () => {
    const d = await handleVoid();
    if (d) setDoc(d);
  };
  const onMarkSentManually = async () => {
    const d = await handleMarkSentManually();
    if (d) setDoc(d);
  };
  const onUpdateNumber = async (num: number) => {
    const d = await handleUpdateNumber(num);
    if (d) setDoc(d);
  };
  const onSend = async () => {
    const ok = await handleSend(sendEmail, sendSubject, sendMessage);
    if (ok) setShowSendModal(false);
  };

  // --- Render ---

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

  const displayItems = isDraft ? editItems : doc.items || [];
  const displayTotals = isDraft ? editTotals : doc.totals;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <DocumentHeader
          doc={doc}
          actionLoading={actionLoading}
          onBack={() => router.push(`${tenantPrefix}/b2b/documents/list`)}
          onUpdateNumber={onUpdateNumber}
        />
        <DocumentActionButtons
          doc={doc}
          documentId={documentId}
          isDraft={!!isDraft}
          hasChanges={hasChanges}
          isSaving={isSaving}
          actionLoading={actionLoading}
          allowedTransitions={allowedTransitions}
          tenantPrefix={tenantPrefix}
          onSave={handleSave}
          onFinalize={onFinalize}
          onSendModal={() => setShowSendModal(true)}
          onMarkSentManually={onMarkSentManually}
          onMarkPaid={onMarkPaid}
          onDownloadPdf={handleDownloadPdf}
          onDuplicate={handleDuplicate}
          onConvert={handleConvert}
          onVoid={onVoid}
          onDelete={handleDelete}
        />
      </div>

      <DocumentPartiesInfo
        doc={doc}
        documentId={documentId}
        isDraft={!!isDraft}
        onDocumentUpdate={setDoc}
      />

      <DocumentPaymentInfo
        doc={doc}
        isDraft={!!isDraft}
        editPaymentTerms={editPaymentTerms}
        editCustomDays={editCustomDays}
        editDueDate={editDueDate}
        onPaymentTermsChange={(v) => {
          setEditPaymentTerms(v);
          setHasChanges(true);
        }}
        onCustomDaysChange={(v) => {
          setEditCustomDays(v);
          setHasChanges(true);
        }}
        onDueDateChange={(v) => {
          setEditDueDate(v);
          setHasChanges(true);
        }}
      />

      <DocumentLineItems
        items={displayItems}
        totals={displayTotals}
        isDraft={!!isDraft}
        currency={doc.currency}
        formatCurrency={formatCurrency}
        onAddItem={addItem}
        onUpdateItem={updateItem}
        onRemoveItem={removeItem}
      />

      <DocumentNotes
        doc={doc}
        isDraft={!!isDraft}
        editNotes={editNotes}
        editInternalNotes={editInternalNotes}
        onNotesChange={(v) => {
          setEditNotes(v);
          setHasChanges(true);
        }}
        onInternalNotesChange={(v) => {
          setEditInternalNotes(v);
          setHasChanges(true);
        }}
      />

      <DocumentHistory history={doc.history} />

      {showSendModal && (
        <SendDocumentModal
          sendEmail={sendEmail}
          sendSubject={sendSubject}
          sendMessage={sendMessage}
          actionLoading={actionLoading}
          onEmailChange={setSendEmail}
          onSubjectChange={setSendSubject}
          onMessageChange={setSendMessage}
          onSend={onSend}
          onClose={() => setShowSendModal(false)}
        />
      )}
    </div>
  );
}
