/**
 * Constants for form-submission CSV export.
 *
 * The wire protocol uses delimiter *words* ("comma" / "semicolon") so a literal
 * comma never has to be escaped inside a JSON request body; the CSV writer takes
 * the character. resolveCsvDelimiter is the only bridge between the two.
 */

/** Hard ceiling on rows per export. Over this the route answers 413 rather than
 *  silently truncating an operator's lead list. */
export const FORM_EXPORT_MAX_ROWS = 10000;

export type CsvDelimiter = "," | ";";
export type CsvDelimiterName = "comma" | "semicolon";

const DELIMITER_BY_NAME: Record<CsvDelimiterName, CsvDelimiter> = {
  comma: ",",
  semicolon: ";",
};

/** Default is semicolon: with a UTF-8 BOM, Excel takes its delimiter from the OS
 *  list separator, which is ";" in both Italian and Slovak locales. */
export const DEFAULT_CSV_DELIMITER: CsvDelimiter = ";";

export function resolveCsvDelimiter(name: unknown): CsvDelimiter {
  if (typeof name === "string" && name in DELIMITER_BY_NAME) {
    return DELIMITER_BY_NAME[name as CsvDelimiterName];
  }
  return DEFAULT_CSV_DELIMITER;
}
