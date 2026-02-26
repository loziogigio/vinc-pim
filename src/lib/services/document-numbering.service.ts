/**
 * Document Numbering Service
 *
 * Handles progressive numbering, format rendering, and settings management.
 */

import { connectWithModels } from "@/lib/db/connection";
import { getNextDocumentNumber, setDocumentCounter, getDocumentCounter } from "@/lib/db/models/counter";
import {
  DOCUMENT_TYPES,
  DEFAULT_NUMBERING_FORMATS,
  DEFAULT_NUMBER_PADDING,
} from "@/lib/constants/document";
import type { DocumentType } from "@/lib/constants/document";
import type { IDocumentSettings } from "@/lib/db/models/document-settings";

// ============================================
// FORMAT RENDERING
// ============================================

/**
 * Format a document number from a template.
 *
 * @example
 * formatDocumentNumber("INV-{YEAR}-{NUMBER}", 2026, 42, 5) => "INV-2026-00042"
 * formatDocumentNumber("Q/{NUMBER}/{YEAR}", 2026, 7, 4)    => "Q/0007/2026"
 */
export function formatDocumentNumber(
  format: string,
  year: number,
  number: number,
  padding: number
): string {
  return format
    .replaceAll("{YEAR}", String(year))
    .replaceAll("{NUMBER}", String(number).padStart(padding, "0"));
}

// ============================================
// SETTINGS
// ============================================

/**
 * Get document settings for a tenant (creates defaults if none exist).
 */
export async function getDocumentSettings(
  tenantDb: string,
  tenantId: string
): Promise<IDocumentSettings> {
  const { DocumentSettings } = await connectWithModels(tenantDb);

  let settings = await DocumentSettings.findOne({ tenant_id: tenantId });

  if (!settings) {
    settings = await DocumentSettings.create({
      settings_id: "global",
      tenant_id: tenantId,
      numbering: DOCUMENT_TYPES.map((type) => ({
        document_type: type,
        format: DEFAULT_NUMBERING_FORMATS[type],
        padding: DEFAULT_NUMBER_PADDING,
        reset_yearly: true,
      })),
      default_currency: "EUR",
      default_validity_days: 30,
    });
  }

  return settings as IDocumentSettings;
}

/**
 * Update document settings.
 */
export async function updateDocumentSettings(
  tenantDb: string,
  tenantId: string,
  updates: Partial<Pick<IDocumentSettings, "numbering" | "default_currency" | "default_payment_terms" | "default_notes" | "default_validity_days">>
): Promise<IDocumentSettings> {
  const { DocumentSettings } = await connectWithModels(tenantDb);

  const settings = await DocumentSettings.findOneAndUpdate(
    { tenant_id: tenantId },
    { $set: updates },
    { new: true, upsert: true }
  );

  return settings as IDocumentSettings;
}

// ============================================
// NUMBER ASSIGNMENT
// ============================================

/**
 * Assign the next progressive number to a document.
 * Returns the formatted document number string and raw number.
 */
export async function assignDocumentNumber(
  tenantDb: string,
  tenantId: string,
  documentType: DocumentType,
  year: number
): Promise<{ document_number: string; document_number_raw: number }> {
  const settings = await getDocumentSettings(tenantDb, tenantId);

  const config = settings.numbering.find((n) => n.document_type === documentType);
  const format = config?.format || DEFAULT_NUMBERING_FORMATS[documentType];
  const padding = config?.padding || DEFAULT_NUMBER_PADDING;

  const rawNumber = await getNextDocumentNumber(tenantDb, documentType, year);
  const formattedNumber = formatDocumentNumber(format, year, rawNumber, padding);

  return {
    document_number: formattedNumber,
    document_number_raw: rawNumber,
  };
}

// ============================================
// COUNTER MANAGEMENT
// ============================================

/**
 * Set the counter for a specific document type and year.
 * The next document of this type will receive value + 1.
 */
export async function setCounter(
  tenantDb: string,
  documentType: DocumentType,
  year: number,
  value: number
): Promise<void> {
  await setDocumentCounter(tenantDb, documentType, year, value);
}

/**
 * Get current counter values for all document types for the current year.
 */
export async function getCounterValues(
  tenantDb: string,
  year?: number
): Promise<Record<string, number>> {
  const currentYear = year || new Date().getFullYear();
  const result: Record<string, number> = {};

  for (const type of DOCUMENT_TYPES) {
    result[`${type}_${currentYear}`] = await getDocumentCounter(tenantDb, type, currentYear);
  }

  return result;
}
