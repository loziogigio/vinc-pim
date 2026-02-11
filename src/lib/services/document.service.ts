/**
 * Document Service
 *
 * Business logic for creating, updating, and managing documents.
 */

import { nanoid } from "nanoid";
import { connectWithModels } from "@/lib/db/connection";
import { getHomeSettings } from "@/lib/db/home-settings";
import { assignDocumentNumber, getDocumentSettings, formatDocumentNumber } from "./document-numbering.service";
import { getDocumentCounter, setDocumentCounter } from "@/lib/db/models/counter";
import { canTransitionDocument, canEditDocument, canDeleteDocument, DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, DEFAULT_NUMBERING_FORMATS } from "@/lib/constants/document";
import { calculateDocumentTotals } from "@/lib/types/document";
import type { DocumentType, DocumentStatus } from "@/lib/constants/document";
import type { IDocument } from "@/lib/db/models/document";
import type {
  DocumentCompanyInfo,
  DocumentCustomerInfo,
  DocumentLineItem,
  DocumentHistoryEntry,
} from "@/lib/types/document";

export interface ServiceResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

// ============================================
// COMPANY INFO SNAPSHOT
// ============================================

/**
 * Build company info snapshot from home settings.
 */
async function getCompanySnapshot(tenantDb: string): Promise<DocumentCompanyInfo> {
  const settings = await getHomeSettings(tenantDb);

  return {
    legal_name: settings?.company_info?.legal_name || settings?.branding?.title || "Company",
    address_line1: settings?.company_info?.address_line1,
    address_line2: settings?.company_info?.address_line2,
    vat_number: settings?.company_info?.vat_number,
    phone: settings?.company_info?.phone,
    email: settings?.company_info?.email,
    logo_url: settings?.branding?.logo,
  };
}

/**
 * Build customer info snapshot from a customer document.
 */
function buildCustomerSnapshot(customer: any): DocumentCustomerInfo {
  const billingAddr = customer.addresses?.find(
    (a: any) => a.address_type === "billing" || a.address_type === "both"
  );

  return {
    customer_id: customer.customer_id,
    company_name: customer.company_name,
    first_name: customer.first_name,
    last_name: customer.last_name,
    email: customer.email,
    phone: customer.phone,
    vat_number: customer.legal_info?.vat_number,
    fiscal_code: customer.legal_info?.fiscal_code,
    pec_email: customer.legal_info?.pec_email,
    sdi_code: customer.legal_info?.sdi_code,
    billing_address: billingAddr
      ? {
          street_address: billingAddr.street_address,
          street_address_2: billingAddr.street_address_2,
          city: billingAddr.city,
          province: billingAddr.province,
          postal_code: billingAddr.postal_code,
          country: billingAddr.country || "IT",
        }
      : undefined,
  };
}

function addHistory(
  history: DocumentHistoryEntry[],
  action: string,
  userId: string,
  userName?: string,
  details?: string
): void {
  history.push({
    action,
    performed_by: userId,
    performed_by_name: userName,
    performed_at: new Date(),
    details,
  });
}

// ============================================
// CREATE
// ============================================

export async function createDocument(
  tenantDb: string,
  tenantId: string,
  input: {
    document_type: DocumentType;
    customer_id: string;
    items?: DocumentLineItem[];
    currency?: string;
    payment_terms?: string;
    payment_method?: string;
    due_date?: Date;
    validity_days?: number;
    notes?: string;
    internal_notes?: string;
    footer_text?: string;
    template_id?: string;
  },
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document, Customer } = await connectWithModels(tenantDb);

  const customer = await Customer.findOne({
    customer_id: input.customer_id,
  }).lean();

  if (!customer) {
    return { success: false, error: "Customer not found", status: 404 };
  }

  const company = await getCompanySnapshot(tenantDb);
  const customerSnapshot = buildCustomerSnapshot(customer);
  const items = input.items || [];
  const totals = calculateDocumentTotals(items);

  const settings = await getDocumentSettings(tenantDb, tenantId);

  const doc = await Document.create({
    document_id: nanoid(12),
    document_type: input.document_type,
    year: new Date().getFullYear(),
    status: "draft",
    tenant_id: tenantId,
    company,
    customer: customerSnapshot,
    items,
    totals,
    currency: input.currency || settings.default_currency || "EUR",
    payment_terms: input.payment_terms || settings.default_payment_terms,
    payment_method: input.payment_method,
    due_date: input.due_date,
    validity_days: input.validity_days || settings.default_validity_days,
    notes: input.notes || settings.default_notes,
    internal_notes: input.internal_notes,
    footer_text: input.footer_text,
    template_id: input.template_id,
    history: [
      {
        action: "created",
        performed_by: userId,
        performed_by_name: userName,
        performed_at: new Date(),
        details: `Created ${input.document_type} draft`,
      },
    ],
  });

  return { success: true, data: doc as IDocument };
}

// ============================================
// CREATE FROM ORDER
// ============================================

export async function createFromOrder(
  tenantDb: string,
  tenantId: string,
  orderId: string,
  documentType: DocumentType,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Order, Customer, Document } = await connectWithModels(tenantDb);

  const order = await Order.findOne({ order_id: orderId }).lean();
  if (!order) {
    return { success: false, error: "Order not found", status: 404 };
  }

  const customer = await Customer.findOne({
    customer_id: (order as any).customer_id,
  }).lean();

  const company = await getCompanySnapshot(tenantDb);
  const customerSnapshot = customer
    ? buildCustomerSnapshot(customer)
    : { customer_id: (order as any).customer_id };

  // Map order line items to document line items
  const items: DocumentLineItem[] = ((order as any).items || []).map((item: any, idx: number) => ({
    line_number: (idx + 1) * 10,
    description: item.name || item.sku || "Item",
    sku: item.sku,
    entity_code: item.entity_code,
    quantity: item.quantity,
    quantity_unit: item.quantity_unit,
    unit_price: item.unit_price,
    vat_rate: item.vat_rate || 22,
    discount_percent: item.total_discount_percent || 0,
    line_net: item.line_net,
    line_vat: item.line_vat,
    line_total: item.line_total,
  }));

  const totals = calculateDocumentTotals(items);
  const settings = await getDocumentSettings(tenantDb, tenantId);

  const doc = await Document.create({
    document_id: nanoid(12),
    document_type: documentType,
    year: new Date().getFullYear(),
    status: "draft",
    tenant_id: tenantId,
    company,
    customer: customerSnapshot,
    items,
    totals,
    currency: (order as any).currency || settings.default_currency || "EUR",
    payment_terms: settings.default_payment_terms,
    notes: (order as any).notes,
    source_order_id: orderId,
    history: [
      {
        action: "created",
        performed_by: userId,
        performed_by_name: userName,
        performed_at: new Date(),
        details: `Created from order ${orderId}`,
      },
    ],
  });

  return { success: true, data: doc as IDocument };
}

// ============================================
// UPDATE (draft only)
// ============================================

export async function updateDocument(
  tenantDb: string,
  documentId: string,
  updates: {
    items?: DocumentLineItem[];
    customer_id?: string;
    currency?: string;
    payment_terms?: string;
    payment_method?: string;
    due_date?: Date;
    validity_days?: number;
    notes?: string;
    internal_notes?: string;
    footer_text?: string;
    template_id?: string;
  },
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document, Customer } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };
  if (!canEditDocument((doc as any).status)) {
    return { success: false, error: "Only draft documents can be edited", status: 400 };
  }

  // Update customer snapshot if customer changed
  if (updates.customer_id) {
    const customer = await Customer.findOne({ customer_id: updates.customer_id }).lean();
    if (!customer) return { success: false, error: "Customer not found", status: 404 };
    (doc as any).customer = buildCustomerSnapshot(customer);
  }

  // Update fields
  if (updates.items !== undefined) {
    (doc as any).items = updates.items;
    (doc as any).totals = calculateDocumentTotals(updates.items);
  }
  if (updates.currency !== undefined) (doc as any).currency = updates.currency;
  if (updates.payment_terms !== undefined) (doc as any).payment_terms = updates.payment_terms;
  if (updates.payment_method !== undefined) (doc as any).payment_method = updates.payment_method;
  if (updates.due_date !== undefined) (doc as any).due_date = updates.due_date;
  if (updates.validity_days !== undefined) (doc as any).validity_days = updates.validity_days;
  if (updates.notes !== undefined) (doc as any).notes = updates.notes;
  if (updates.internal_notes !== undefined) (doc as any).internal_notes = updates.internal_notes;
  if (updates.footer_text !== undefined) (doc as any).footer_text = updates.footer_text;
  if (updates.template_id !== undefined) (doc as any).template_id = updates.template_id;

  addHistory((doc as any).history, "updated", userId, userName, "Document updated");
  await doc.save();

  return { success: true, data: doc as IDocument };
}

// ============================================
// DELETE (draft only)
// ============================================

export async function deleteDocument(
  tenantDb: string,
  tenantId: string,
  documentId: string
): Promise<ServiceResult> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  const d = doc as any;
  if (!canDeleteDocument(d.status)) {
    return { success: false, error: "Solo bozze e documenti finalizzati (non inviati) possono essere eliminati", status: 400 };
  }

  // If finalized with a number, try to decrement counter if it was the last one
  if (d.status === "finalized" && d.document_number_raw && d.document_type && d.year) {
    const currentCounter = await getDocumentCounter(tenantDb, d.document_type, d.year);
    if (d.document_number_raw === currentCounter) {
      await setDocumentCounter(tenantDb, d.document_type, d.year, currentCounter - 1);
    }
  }

  await Document.deleteOne({ document_id: documentId });
  return { success: true };
}

// ============================================
// FINALIZE
// ============================================

export async function finalizeDocument(
  tenantDb: string,
  tenantId: string,
  documentId: string,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  if (!canTransitionDocument((doc as any).status, "finalized")) {
    return { success: false, error: "Document cannot be finalized from current status", status: 400 };
  }

  if (!(doc as any).items?.length) {
    return { success: false, error: "Cannot finalize a document with no line items", status: 400 };
  }

  // Assign progressive number
  const { document_number, document_number_raw } = await assignDocumentNumber(
    tenantDb,
    tenantId,
    (doc as any).document_type,
    (doc as any).year
  );

  (doc as any).document_number = document_number;
  (doc as any).document_number_raw = document_number_raw;
  (doc as any).status = "finalized";
  (doc as any).finalized_at = new Date();

  // Refresh company snapshot at finalization time
  const company = await getCompanySnapshot(tenantDb);
  (doc as any).company = company;

  addHistory((doc as any).history, "finalized", userId, userName, `Assigned number ${document_number}`);
  addHistory((doc as any).history, "number_assigned", userId, userName, document_number);

  await doc.save();
  return { success: true, data: doc as IDocument };
}

// ============================================
// MARK AS PAID (invoices only)
// ============================================

export async function markDocumentPaid(
  tenantDb: string,
  documentId: string,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  if ((doc as any).document_type !== "invoice") {
    return { success: false, error: "Only invoices can be marked as paid", status: 400 };
  }
  if (!canTransitionDocument((doc as any).status, "paid")) {
    return { success: false, error: "Document cannot be marked as paid from current status", status: 400 };
  }

  (doc as any).status = "paid";
  addHistory((doc as any).history, "paid", userId, userName, "Marked as paid");
  await doc.save();

  return { success: true, data: doc as IDocument };
}

// ============================================
// VOID
// ============================================

export async function voidDocument(
  tenantDb: string,
  documentId: string,
  userId: string,
  userName?: string,
  reason?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  if (!canTransitionDocument((doc as any).status, "voided")) {
    return { success: false, error: "Document cannot be voided from current status", status: 400 };
  }

  (doc as any).status = "voided";
  (doc as any).voided_at = new Date();
  addHistory(
    (doc as any).history,
    "voided",
    userId,
    userName,
    reason || "Document voided"
  );
  await doc.save();

  return { success: true, data: doc as IDocument };
}

// ============================================
// DUPLICATE
// ============================================

export async function duplicateDocument(
  tenantDb: string,
  tenantId: string,
  documentId: string,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const original = await Document.findOne({ document_id: documentId }).lean();
  if (!original) return { success: false, error: "Document not found", status: 404 };

  const src = original as any;
  const company = await getCompanySnapshot(tenantDb);

  const newDoc = await Document.create({
    document_id: nanoid(12),
    document_type: src.document_type,
    year: new Date().getFullYear(),
    status: "draft",
    tenant_id: tenantId,
    company,
    customer: src.customer,
    items: src.items,
    totals: src.totals,
    currency: src.currency,
    payment_terms: src.payment_terms,
    payment_method: src.payment_method,
    validity_days: src.validity_days,
    notes: src.notes,
    internal_notes: src.internal_notes,
    footer_text: src.footer_text,
    template_id: src.template_id,
    source_document_id: documentId,
    duplicated_from: documentId,
    duplicated_at: new Date(),
    history: [
      {
        action: "duplicated",
        performed_by: userId,
        performed_by_name: userName,
        performed_at: new Date(),
        details: `Duplicated from ${src.document_number || documentId}`,
      },
    ],
  });

  // Track duplication on original
  await Document.updateOne(
    { document_id: documentId },
    { $push: { related_documents: (newDoc as any).document_id } }
  );

  return { success: true, data: newDoc as IDocument };
}

// ============================================
// CONVERT DOCUMENT TYPE
// ============================================

/**
 * Convert a document to a different type (e.g. quotation → invoice).
 * Creates a new draft of the target type, copying all data from the source.
 */
export async function convertDocument(
  tenantDb: string,
  tenantId: string,
  documentId: string,
  targetType: DocumentType,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  if (!(DOCUMENT_TYPES as readonly string[]).includes(targetType)) {
    return { success: false, error: "Invalid target document type", status: 400 };
  }

  const { Document } = await connectWithModels(tenantDb);

  const original = await Document.findOne({ document_id: documentId }).lean();
  if (!original) return { success: false, error: "Document not found", status: 404 };

  const src = original as any;

  if (src.document_type === targetType) {
    return { success: false, error: "Il documento è già di questo tipo", status: 400 };
  }

  const company = await getCompanySnapshot(tenantDb);
  const sourceLabel = DOCUMENT_TYPE_LABELS[src.document_type as DocumentType] || src.document_type;
  const targetLabel = DOCUMENT_TYPE_LABELS[targetType];

  const newDoc = await Document.create({
    document_id: nanoid(12),
    document_type: targetType,
    year: new Date().getFullYear(),
    status: "draft",
    tenant_id: tenantId,
    company,
    customer: src.customer,
    items: src.items,
    totals: src.totals,
    currency: src.currency,
    payment_terms: src.payment_terms,
    payment_method: src.payment_method,
    due_date: src.due_date,
    validity_days: src.validity_days,
    notes: src.notes,
    internal_notes: src.internal_notes,
    footer_text: src.footer_text,
    template_id: src.template_id,
    source_document_id: documentId,
    history: [
      {
        action: "created",
        performed_by: userId,
        performed_by_name: userName,
        performed_at: new Date(),
        details: `Convertito da ${sourceLabel} ${src.document_number || documentId} a ${targetLabel}`,
      },
    ],
  });

  // Track relation on original
  await Document.updateOne(
    { document_id: documentId },
    { $push: { related_documents: (newDoc as any).document_id } }
  );

  return { success: true, data: newDoc as IDocument };
}

// ============================================
// MARK AS SENT (update status after email)
// ============================================

export async function markDocumentSent(
  tenantDb: string,
  documentId: string,
  recipientEmail: string,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  // Allow re-sending from "sent" or "finalized" status
  if ((doc as any).status === "finalized") {
    (doc as any).status = "sent";
  }

  (doc as any).last_sent_at = new Date();
  (doc as any).send_count = ((doc as any).send_count || 0) + 1;
  if (!(doc as any).sent_to) (doc as any).sent_to = [];
  if (!((doc as any).sent_to as string[]).includes(recipientEmail)) {
    ((doc as any).sent_to as string[]).push(recipientEmail);
  }

  addHistory((doc as any).history, "sent", userId, userName, `Sent to ${recipientEmail}`);
  await doc.save();

  return { success: true, data: doc as IDocument };
}

// ============================================
// MARK AS SENT MANUALLY
// ============================================

export async function markSentManually(
  tenantDb: string,
  documentId: string,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  if ((doc as any).status !== "finalized") {
    return { success: false, error: "Solo documenti finalizzati possono essere contrassegnati come inviati", status: 400 };
  }

  (doc as any).status = "sent";
  (doc as any).last_sent_at = new Date();
  addHistory((doc as any).history, "sent", userId, userName, "Contrassegnato come inviato manualmente");
  await doc.save();

  return { success: true, data: doc as IDocument };
}

// ============================================
// UPDATE DOCUMENT NUMBER (finalized only)
// ============================================

export async function updateDocumentNumber(
  tenantDb: string,
  tenantId: string,
  documentId: string,
  newNumber: number,
  userId: string,
  userName?: string
): Promise<ServiceResult<IDocument>> {
  const { Document } = await connectWithModels(tenantDb);

  const doc = await Document.findOne({ document_id: documentId });
  if (!doc) return { success: false, error: "Document not found", status: 404 };

  const d = doc as any;
  if (d.status !== "finalized") {
    return { success: false, error: "Solo documenti finalizzati (non inviati) possono cambiare numero", status: 400 };
  }

  if (!Number.isInteger(newNumber) || newNumber < 1) {
    return { success: false, error: "Il numero deve essere un intero positivo", status: 400 };
  }

  // Get numbering settings for formatting
  const settings = await getDocumentSettings(tenantDb, tenantId);
  const config = settings.numbering.find((n) => n.document_type === d.document_type);
  const format = config?.format || DEFAULT_NUMBERING_FORMATS[d.document_type as DocumentType];
  const padding = config?.padding || 5;

  const newFormattedNumber = formatDocumentNumber(format, d.year, newNumber, padding);

  // Check uniqueness
  const existing = await Document.findOne({
    tenant_id: tenantId,
    document_number: newFormattedNumber,
    document_id: { $ne: documentId },
  });
  if (existing) {
    return { success: false, error: `Il numero ${newFormattedNumber} è già utilizzato da un altro documento`, status: 409 };
  }

  const oldNumber = d.document_number;
  d.document_number = newFormattedNumber;
  d.document_number_raw = newNumber;

  // Update counter to max(current, newNumber) to avoid collisions
  const currentCounter = await getDocumentCounter(tenantDb, d.document_type, d.year);
  if (newNumber > currentCounter) {
    await setDocumentCounter(tenantDb, d.document_type, d.year, newNumber);
  }

  addHistory(d.history, "number_updated", userId, userName, `Numero aggiornato da ${oldNumber} a ${newFormattedNumber}`);
  await doc.save();

  return { success: true, data: doc as IDocument };
}
