"use client";

import { useState } from "react";
import { Breadcrumbs } from "@/components/b2b/Breadcrumbs";
import { BackButton } from "@/components/b2b/BackButton";
import { Upload, FileSpreadsheet, Settings, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type UploadStep = "upload" | "mapping" | "preview" | "importing" | "complete";

type ColumnMapping = {
  [excelColumn: string]: string; // Maps Excel column name to our field name
};

type FileData = {
  file: File;
  headers: string[];
  preview: any[];
  totalRows: number;
};

export default function B2BImportPage() {
  const [currentStep, setCurrentStep] = useState<UploadStep>("upload");
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [isDragging, setIsDragging] = useState(false);

  // Target fields that products can map to
  const targetFields = [
    { value: "sku", label: "SKU (required)", required: true },
    { value: "title", label: "Title/Name (required)", required: true },
    { value: "description", label: "Description", required: false },
    { value: "category", label: "Category", required: false },
    { value: "price", label: "Price", required: false },
    { value: "stock", label: "Stock/Inventory", required: false },
    { value: "images", label: "Images (comma-separated URLs)", required: false },
    { value: "brand", label: "Brand", required: false },
    { value: "supplier", label: "Supplier", required: false },
    { value: "status", label: "Status", required: false },
    { value: "_ignore", label: "-- Ignore Column --", required: false },
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = async (file: File) => {
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      alert("Invalid file type. Please upload .xlsx, .xls, or .csv files.");
      return;
    }

    // Parse file to get headers and preview
    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert("File is empty or has no valid data");
        return;
      }

      const headers = Object.keys(jsonData[0]);
      const preview = jsonData.slice(0, 5); // First 5 rows for preview

      setFileData({
        file,
        headers,
        preview,
        totalRows: jsonData.length,
      });

      // Auto-map columns based on common names
      const autoMapping: ColumnMapping = {};
      headers.forEach((header) => {
        const lowerHeader = header.toLowerCase();
        if (lowerHeader === "sku" || lowerHeader === "code") {
          autoMapping[header] = "sku";
        } else if (lowerHeader === "title" || lowerHeader === "name" || lowerHeader === "product name") {
          autoMapping[header] = "title";
        } else if (lowerHeader === "description" || lowerHeader === "desc") {
          autoMapping[header] = "description";
        } else if (lowerHeader === "category" || lowerHeader === "type") {
          autoMapping[header] = "category";
        } else if (lowerHeader === "price" || lowerHeader === "cost") {
          autoMapping[header] = "price";
        } else if (lowerHeader === "stock" || lowerHeader === "inventory") {
          autoMapping[header] = "stock";
        } else if (lowerHeader === "images" || lowerHeader === "image") {
          autoMapping[header] = "images";
        } else if (lowerHeader === "brand" || lowerHeader === "manufacturer") {
          autoMapping[header] = "brand";
        } else if (lowerHeader === "supplier" || lowerHeader === "vendor") {
          autoMapping[header] = "supplier";
        } else if (lowerHeader === "status") {
          autoMapping[header] = "status";
        } else {
          autoMapping[header] = "_ignore";
        }
      });

      setColumnMapping(autoMapping);
      setCurrentStep("mapping");
    } catch (error) {
      console.error("File parse error:", error);
      alert("Failed to parse file. Please check the file format.");
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleMappingChange = (excelColumn: string, targetField: string) => {
    setColumnMapping((prev) => ({
      ...prev,
      [excelColumn]: targetField,
    }));
  };

  const validateMapping = (): boolean => {
    // Check if required fields are mapped
    const mappedValues = Object.values(columnMapping);
    const hasSKU = mappedValues.includes("sku");
    const hasTitle = mappedValues.includes("title");

    if (!hasSKU || !hasTitle) {
      alert("Please map both SKU and Title fields (required)");
      return false;
    }

    return true;
  };

  const handleImport = async () => {
    if (!validateMapping() || !fileData) return;

    setCurrentStep("importing");

    try {
      // Create a transformed file with mapped columns
      const XLSX = await import("xlsx");
      const arrayBuffer = await fileData.file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

      // Transform data using mapping
      const transformedData = jsonData.map((row) => {
        const newRow: any = {};
        Object.entries(columnMapping).forEach(([excelCol, targetField]) => {
          if (targetField !== "_ignore") {
            newRow[targetField.toUpperCase()] = row[excelCol];
          }
        });
        return newRow;
      });

      // Create new workbook with transformed data
      const newWorksheet = XLSX.utils.json_to_sheet(transformedData);
      const newWorkbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, "Products");

      // Convert to buffer
      const newBuffer = XLSX.write(newWorkbook, { type: "array", bookType: "xlsx" });
      const newFile = new File([newBuffer], fileData.file.name, {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Upload the transformed file
      const formData = new FormData();
      formData.append("file", newFile);

      const response = await fetch("/api/b2b/products/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      setCurrentStep("complete");
    } catch (error: any) {
      alert(error.message || "Import failed");
      setCurrentStep("mapping");
    }
  };

  const handleReset = () => {
    setCurrentStep("upload");
    setFileData(null);
    setColumnMapping({});
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-[1400px] px-4 py-3">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Breadcrumbs items={[{ label: "Import Products" }]} />
            <BackButton />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Import Products</h1>
              <p className="text-xs text-muted-foreground">
                Upload Excel or CSV files and map columns to product fields
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              currentStep === "upload" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <Upload className="h-3.5 w-3.5" />
              1. Upload
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              currentStep === "mapping" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <Settings className="h-3.5 w-3.5" />
              2. Mapping
            </div>
            <div className="h-px w-8 bg-border" />
            <div className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
              ["importing", "complete"].includes(currentStep) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              <CheckCircle className="h-3.5 w-3.5" />
              3. Import
            </div>
          </div>

          {/* Upload Step */}
          {currentStep === "upload" && (
            <div className="rounded-lg bg-card p-5 shadow-sm">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-lg border-2 border-dashed p-8 transition-colors ${
                  isDragging
                    ? "border-primary bg-primary/5"
                    : "border-muted-foreground/25 bg-muted/30"
                }`}
              >
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileInputChange}
                  className="hidden"
                  id="file-input"
                />

                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-primary/10">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="mb-2 text-base font-semibold">Upload Excel or CSV File</h3>
                  <p className="mb-4 text-sm text-muted-foreground">
                    Drag and drop your file here, or click to browse
                  </p>
                  <Button size="sm" onClick={() => document.getElementById("file-input")?.click()}>
                    <Upload className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Supported formats: .xlsx, .xls, .csv (max 10MB)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mapping Step */}
          {currentStep === "mapping" && fileData && (
            <div className="space-y-3">
              <div className="rounded-lg bg-card p-3.5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4 w-4 text-primary" />
                    <h2 className="text-sm font-semibold">File Info</h2>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleReset} className="h-7 text-xs">
                    Change File
                  </Button>
                </div>
                <div className="space-y-1 text-xs">
                  <p><strong>File:</strong> {fileData.file.name}</p>
                  <p><strong>Total Rows:</strong> {fileData.totalRows.toLocaleString()}</p>
                  <p><strong>Columns:</strong> {fileData.headers.length}</p>
                </div>
              </div>

              <div className="rounded-lg bg-card p-3.5 shadow-sm">
                <div className="mb-3 flex items-center gap-1.5">
                  <Settings className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold">Column Mapping</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Map your Excel columns to product fields. Fields marked as <span className="text-red-500">required</span> must be mapped.
                </p>

                <div className="space-y-2">
                  {fileData.headers.map((header) => (
                    <div key={header} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2.5">
                      <div className="flex-1">
                        <p className="text-xs font-medium">{header}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {fileData.preview[0]?.[header]?.toString().substring(0, 40)}...
                        </p>
                      </div>
                      <div className="w-48">
                        <select
                          value={columnMapping[header] || "_ignore"}
                          onChange={(e) => handleMappingChange(header, e.target.value)}
                          className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
                        >
                          {targetFields.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleReset} className="h-9 text-sm">
                  Cancel
                </Button>
                <Button onClick={handleImport} className="h-9 text-sm">
                  <Upload className="mr-2 h-4 w-4" />
                  Import Products
                </Button>
              </div>
            </div>
          )}

          {/* Importing Step */}
          {currentStep === "importing" && (
            <div className="rounded-lg bg-card p-8 shadow-sm text-center">
              <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
              <h3 className="text-base font-semibold mb-2">Importing Products...</h3>
              <p className="text-sm text-muted-foreground">
                Please wait while we process your file
              </p>
            </div>
          )}

          {/* Complete Step */}
          {currentStep === "complete" && (
            <div className="rounded-lg bg-card p-8 shadow-sm text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950">
                <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-base font-semibold mb-2">Import Complete!</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Your products have been successfully imported
              </p>
              <div className="flex justify-center gap-2">
                <Button variant="outline" onClick={handleReset} className="h-9 text-sm">
                  Import Another File
                </Button>
                <Button onClick={() => window.location.href = "/b2b/catalog"} className="h-9 text-sm">
                  View Catalog
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
