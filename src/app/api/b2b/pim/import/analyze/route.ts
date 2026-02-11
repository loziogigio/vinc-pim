import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse/sync";
import { readExcel } from "@/lib/utils/excel";

/**
 * POST /api/b2b/pim/import/analyze
 * Analyze uploaded file and return column preview
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Missing file parameter in request" },
        { status: 400 }
      );
    }

    // Validate file is actually a File object
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Invalid file object" },
        { status: 400 }
      );
    }

    // Validate file has content
    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 50MB)" },
        { status: 400 }
      );
    }

    // Validate file type
    const fileExt = file.name.toLowerCase().split(".").pop();
    if (!["csv", "xlsx", "xls"].includes(fileExt || "")) {
      return NextResponse.json(
        { error: `Invalid file type: .${fileExt}. Only CSV and Excel files are supported` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    let rows: any[] = [];
    let columns: string[] = [];

    // Parse based on file type
    if (fileExt === "csv") {
      // Parse CSV with better error handling
      try {
        const records = parse(buffer, {
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_quotes: true,
          relax_column_count: true, // Allow inconsistent column counts
        });

        rows = records.slice(0, 15); // Get first 15 rows
        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        }

        if (rows.length === 0) {
          return NextResponse.json(
            { error: "CSV file contains no data rows" },
            { status: 400 }
          );
        }
      } catch (csvError: any) {
        // Provide user-friendly CSV error message
        const errorMsg = csvError.message || "CSV parsing failed";
        const lineInfo = csvError.lines ? ` at line ${csvError.lines}` : "";

        let userFriendlyMessage = errorMsg + lineInfo;

        // Make common errors more understandable
        if (errorMsg.includes("Invalid Record Length") || errorMsg.includes("columns")) {
          userFriendlyMessage = `Your CSV file has inconsistent columns${lineInfo}. Some rows have different numbers of columns than the header row. Please check for unescaped quotes (") or extra commas in your data.`;
        } else if (errorMsg.includes("quote")) {
          userFriendlyMessage = `Your CSV file has improperly quoted fields${lineInfo}. Please check that all quotes are properly escaped (use "" inside quoted fields).`;
        }

        return NextResponse.json(
          {
            error: "CSV Format Error",
            details: userFriendlyMessage,
            hint: "Common fixes: Remove special characters from field values, properly quote fields containing commas, or use Excel format instead.",
            technicalDetails: csvError.code ? {
              code: csvError.code,
              line: csvError.lines,
              column: csvError.column
            } : undefined
          },
          { status: 400 }
        );
      }
    } else {
      // Parse Excel
      try {
        const workbook = await readExcel(buffer);

        if (!workbook.sheetNames.length) {
          return NextResponse.json(
            { error: "Excel file contains no sheets" },
            { status: 400 }
          );
        }

        const firstSheetName = workbook.sheetNames[0];
        const worksheet = workbook.sheets[firstSheetName];

        // Convert to JSON
        const jsonData = worksheet.toJSON({ defval: "" });
        rows = jsonData.slice(0, 15); // Get first 15 rows

        if (rows.length > 0) {
          columns = Object.keys(rows[0]);
        }

        if (rows.length === 0) {
          return NextResponse.json(
            { error: "Excel file contains no data rows" },
            { status: 400 }
          );
        }
      } catch (excelError: any) {
        return NextResponse.json(
          {
            error: "Excel Format Error",
            details: `Failed to read Excel file: ${excelError.message}. Please ensure the file is a valid Excel file.`
          },
          { status: 400 }
        );
      }
    }

    // Analyze columns
    const columnAnalysis = columns.map((col) => {
      const values = rows.map((row) => row[col]).filter(v => v !== null && v !== undefined && v !== "");
      const uniqueValues = new Set(values);

      // Detect type
      let type = "string";
      if (values.length > 0) {
        const numericCount = values.filter(v => !isNaN(Number(v))).length;
        if (numericCount / values.length > 0.8) {
          type = "number";
        }
      }

      return {
        name: col,
        type,
        sampleValues: Array.from(uniqueValues).slice(0, 5),
        totalValues: values.length,
        uniqueCount: uniqueValues.size,
        emptyCount: rows.length - values.length,
      };
    });

    return NextResponse.json({
      fileName: file.name,
      fileSize: file.size,
      fileType: fileExt,
      totalRows: rows.length,
      columns: columnAnalysis,
      previewRows: rows.slice(0, 10), // Return first 10 rows for preview
    });
  } catch (error: any) {
    console.error("Error analyzing file:", error);
    return NextResponse.json(
      { error: "Failed to analyze file", details: error.message },
      { status: 500 }
    );
  }
}
