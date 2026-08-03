import { DEFAULT_CSV_DELIMITER, type CsvDelimiter } from "@/lib/constants/form-export";

/**
 * Shared CSV writer.
 *
 * The repo has ~7 export routes that each re-declare their own escaping; this is
 * the first shared implementation. New export code uses this. Retrofitting the
 * existing routes is deliberately out of scope.
 */

export interface CsvColumn {
  key: string;
  header: string;
}

/** Characters that make Excel/LibreOffice treat a cell as a formula. */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Escapes one cell.
 *
 * Form submissions are unauthenticated public input opened in Excel by an
 * operator, so a leading formula character is neutralised with an apostrophe
 * before the normal RFC-4180 quoting is applied.
 */
export function escapeCsvValue(value: unknown, delimiter: CsvDelimiter): string {
  let text = stringify(value);
  if (text === "") return "";

  // Track if this was originally an object (including arrays) - always quote for safety
  const wasObject = typeof value === "object" && value !== null;

  if (FORMULA_PREFIXES.includes(text[0])) {
    text = `'${text}`;
  }

  const needsQuoting =
    wasObject ||
    text.includes(delimiter) ||
    text.includes('"') ||
    text.includes("\n") ||
    text.includes("\r");

  if (needsQuoting) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(opts: {
  columns: CsvColumn[];
  rows: Array<Record<string, unknown>>;
  delimiter?: CsvDelimiter;
  bom?: boolean;
}): string {
  const delimiter = opts.delimiter ?? DEFAULT_CSV_DELIMITER;
  const withBom = opts.bom ?? true;

  const headerLine = opts.columns
    .map((column) => escapeCsvValue(column.header, delimiter))
    .join(delimiter);

  const dataLines = opts.rows.map((row) =>
    opts.columns
      .map((column) => escapeCsvValue(row[column.key], delimiter))
      .join(delimiter)
  );

  const body = [headerLine, ...dataLines].join("\r\n");
  return withBom ? `﻿${body}` : body;
}
