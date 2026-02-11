/**
 * Excel file parsing utility using ExcelJS
 * Replaces vulnerable xlsx (SheetJS) package
 */

import ExcelJS from "exceljs";

export interface ExcelWorkbook {
  sheetNames: string[];
  sheets: Record<string, ExcelSheet>;
}

export interface ExcelSheet {
  toJSON(options?: { defval?: any; header?: number }): Record<string, any>[];
}

/**
 * Read an Excel file from a Buffer or ArrayBuffer
 */
export async function readExcel(
  input: Buffer | ArrayBuffer
): Promise<ExcelWorkbook> {
  const workbook = new ExcelJS.Workbook();
  const buffer = input instanceof ArrayBuffer ? Buffer.from(input) : input;
  await workbook.xlsx.load(buffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);
  const sheets: Record<string, ExcelSheet> = {};

  for (const ws of workbook.worksheets) {
    sheets[ws.name] = createSheet(ws);
  }

  return { sheetNames, sheets };
}

function createSheet(worksheet: ExcelJS.Worksheet): ExcelSheet {
  return {
    toJSON(options?: { defval?: any; header?: number }) {
      const defval = options?.defval;
      const useRawIndices = options?.header === 1;
      const rows: any[] = [];
      const headers: (string | number)[] = [];

      worksheet.eachRow((row, rowNumber) => {
        const values = row.values as any[];
        // ExcelJS row.values is 1-indexed (index 0 is undefined)

        if (rowNumber === 1 && !useRawIndices) {
          // First row = headers
          for (let i = 1; i < values.length; i++) {
            headers.push(
              values[i] !== null && values[i] !== undefined
                ? String(values[i])
                : `Column${i}`
            );
          }
          return;
        }

        if (useRawIndices) {
          // Return as array (header: 1 mode)
          const arr: any[] = [];
          for (let i = 1; i < values.length; i++) {
            arr.push(resolveCellValue(values[i], defval));
          }
          rows.push(arr);
        } else {
          // Return as object with header keys
          const obj: Record<string, any> = {};
          for (let i = 0; i < headers.length; i++) {
            const val = i + 1 < values.length ? values[i + 1] : undefined;
            const resolved = resolveCellValue(val, defval);
            if (resolved !== undefined) {
              obj[headers[i]] = resolved;
            }
          }
          // Only add row if it has at least one non-empty value
          if (Object.keys(obj).length > 0) {
            rows.push(obj);
          }
        }
      });

      return rows;
    },
  };
}

/**
 * Resolve ExcelJS cell value to a plain value
 * ExcelJS wraps some values in objects (e.g., { richText, hyperlink, formula })
 */
function resolveCellValue(val: any, defval?: any): any {
  if (val === null || val === undefined) {
    return defval;
  }

  // ExcelJS rich text
  if (typeof val === "object" && val.richText) {
    return val.richText.map((r: any) => r.text).join("");
  }

  // ExcelJS hyperlink
  if (typeof val === "object" && val.hyperlink) {
    return val.text || val.hyperlink;
  }

  // ExcelJS formula result
  if (typeof val === "object" && val.formula) {
    return val.result ?? defval;
  }

  // ExcelJS error
  if (typeof val === "object" && val.error) {
    return defval;
  }

  // Date objects - return as-is
  if (val instanceof Date) {
    return val;
  }

  return val;
}
