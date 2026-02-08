/**
 * Fiscal ID Validation
 *
 * Pure regex-based validation for country-specific fiscal identifiers.
 * Non-blocking: returns boolean or { valid, message }.
 */

// ============================================
// ITALY
// ============================================

/** Validate Italian VAT number (Partita IVA): "IT" + 11 digits */
export function validateItalianVAT(value: string): boolean {
  return /^IT\d{11}$/.test(value.toUpperCase().replace(/\s/g, ""));
}

/** Validate Italian Fiscal Code (Codice Fiscale): 16 alphanumeric */
export function validateItalianFiscalCode(value: string): boolean {
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(
    value.toUpperCase().replace(/\s/g, ""),
  );
}

// ============================================
// SLOVAKIA
// ============================================

/** Validate Slovak VAT number (IČ DPH): "SK" + 10 digits */
export function validateSlovakVAT(value: string): boolean {
  return /^SK\d{10}$/.test(value.toUpperCase().replace(/\s/g, ""));
}

/** Validate Slovak Tax ID (DIČ): 10 digits */
export function validateSlovakTaxId(value: string): boolean {
  return /^\d{10}$/.test(value.replace(/\s/g, ""));
}

/** Validate Slovak Company ID (IČO): 8 digits */
export function validateSlovakCompanyId(value: string): boolean {
  return /^\d{8}$/.test(value.replace(/\s/g, ""));
}

// ============================================
// GENERIC DISPATCHER
// ============================================

export interface FiscalIdValidationResult {
  valid: boolean;
  message?: string;
}

const VALIDATORS: Record<string, Record<string, (v: string) => boolean>> = {
  IT: {
    vat_number: validateItalianVAT,
    fiscal_code: validateItalianFiscalCode,
  },
  SK: {
    vat_number: validateSlovakVAT,
    tax_id: validateSlovakTaxId,
    company_id: validateSlovakCompanyId,
  },
};

/**
 * Validate a fiscal ID field by country code and field name.
 */
export function validateFiscalId(
  countryCode: string,
  fieldKey: string,
  value: string,
): FiscalIdValidationResult {
  const trimmed = value.replace(/\s/g, "");

  if (!trimmed) {
    return { valid: false, message: "Value is required" };
  }

  const country = countryCode.toUpperCase();
  const countryValidators = VALIDATORS[country];
  if (!countryValidators) {
    return { valid: true };
  }

  const validator = countryValidators[fieldKey];
  if (!validator) {
    return { valid: true };
  }

  if (validator(trimmed)) {
    return { valid: true };
  }

  return { valid: false, message: `Invalid format for ${fieldKey}` };
}
