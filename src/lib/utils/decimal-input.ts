/**
 * Shared utilities for decimal/price input fields.
 *
 * Use these instead of `type="number"` inputs so users can:
 * - Clear the field and type fresh values
 * - Type partial decimals like "25."
 * - Use comma as decimal separator (Italian/European keyboards)
 *
 * @example
 * ```tsx
 * import { normalizeDecimalInput, parseDecimalValue, toDecimalInputValue } from "@/lib/utils/decimal-input";
 *
 * const [priceInput, setPriceInput] = useState("");
 *
 * function handleChange(rawValue: string) {
 *   const normalized = normalizeDecimalInput(rawValue);
 *   if (normalized === null) return;
 *   setPriceInput(normalized);
 *   setNumericPrice(parseDecimalValue(normalized));
 * }
 *
 * <Input type="text" inputMode="decimal" value={priceInput} onChange={e => handleChange(e.target.value)} />
 * ```
 */

/**
 * Normalize decimal input for Italian/European keyboards.
 * Replaces comma with dot, validates format.
 * Handles pasted values with thousand separators (e.g., "1,120.00" or "1.120,00").
 * Returns normalized string or null if invalid.
 */
export function normalizeDecimalInput(value: string): string | null {
  let normalized = value.trim();

  // Handle pasted values with thousand separators:
  // English format: "1,120.00" (comma = thousands, dot = decimal)
  // Italian format: "1.120,00" (dot = thousands, comma = decimal)
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(normalized)) {
    // English format: strip thousand commas
    normalized = normalized.replace(/,/g, "");
  } else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(normalized)) {
    // Italian format: strip thousand dots, comma → dot
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    // Simple comma → dot for single decimal comma (e.g., "3,5")
    normalized = normalized.replace(",", ".");
  }

  if (normalized === "" || /^[0-9]*\.?[0-9]*$/.test(normalized)) {
    return normalized;
  }
  return null;
}

/**
 * Parse a decimal input string to a number.
 * Returns undefined if empty or NaN.
 */
export function parseDecimalValue(value: string): number | undefined {
  if (value === "") return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Format a number (or undefined) to its string representation for input display.
 */
export function toDecimalInputValue(value: number | undefined | null): string {
  if (value === undefined || value === null) return "";
  return String(value);
}
