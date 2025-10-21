"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type UploadResult = {
  total: number;
  created: number;
  updated: number;
  errors: number;
  errorDetails?: Array<{ row: number; error: string; data: any }>;
};

type FileUploadProps = {
  onUploadComplete?: (result: UploadResult) => void;
};

export function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    // Validate file type
    const validTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setUploadError("Invalid file type. Please upload .xlsx, .xls, or .csv files.");
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadResult(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/b2b/products/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setUploadResult(data.results);
      if (onUploadComplete) {
        onUploadComplete(data.results);
      }

      // Clear file after successful upload
      setTimeout(() => {
        handleRemoveFile();
      }, 3000);
    } catch (error: any) {
      setUploadError(error.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 bg-muted/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInputChange}
          className="hidden"
        />

        {!selectedFile ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              <Upload className="h-6 w-6 text-primary" />
            </div>
            <h3 className="mb-1 text-sm font-semibold">Upload Excel or CSV</h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Drag and drop your file here, or click to browse
            </p>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs"
            >
              Select File
            </Button>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Supported formats: .xlsx, .xls, .csv (max 10MB)
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </p>
                </div>
                {!isUploading && !uploadResult && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleRemoveFile}
                    className="h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upload button */}
      {selectedFile && !uploadResult && (
        <Button
          onClick={handleUpload}
          disabled={isUploading}
          className="w-full h-9 text-sm"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="mr-2 h-4 w-4" />
              Upload & Import
            </>
          )}
        </Button>
      )}

      {/* Error message */}
      {uploadError && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 p-3">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs font-semibold text-red-900 dark:text-red-200">
              Upload Failed
            </p>
            <p className="text-xs text-red-700 dark:text-red-300">{uploadError}</p>
          </div>
        </div>
      )}

      {/* Success result */}
      {uploadResult && (
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-3">
            <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                Upload Successful
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                Processed {uploadResult.total} rows
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-card p-3 border">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {uploadResult.created}
                </p>
                <p className="text-[11px] text-muted-foreground">Created</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {uploadResult.updated}
                </p>
                <p className="text-[11px] text-muted-foreground">Updated</p>
              </div>
              <div>
                <p className={`text-2xl font-bold ${uploadResult.errors > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {uploadResult.errors}
                </p>
                <p className="text-[11px] text-muted-foreground">Errors</p>
              </div>
            </div>

            {uploadResult.errorDetails && uploadResult.errorDetails.length > 0 && (
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs font-semibold mb-2">Error Details (first 10):</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {uploadResult.errorDetails.map((err, idx) => (
                    <div key={idx} className="text-[11px] text-muted-foreground">
                      <span className="font-medium">Row {err.row}:</span> {err.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template info */}
      <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/40 p-3">
        <h4 className="text-xs font-semibold text-emerald-900 dark:text-emerald-200 mb-1.5">
          Required Columns
        </h4>
        <ul className="space-y-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
          <li>• <strong>SKU</strong> (required) - Unique product identifier</li>
          <li>• <strong>Title/Name</strong> (required) - Product name</li>
          <li>• <strong>Description</strong> - Product description</li>
          <li>• <strong>Category</strong> - Product category</li>
          <li>• <strong>Price</strong> - Product price</li>
          <li>• <strong>Stock</strong> - Inventory quantity</li>
          <li>• <strong>Images</strong> - Comma-separated image URLs</li>
          <li>• <strong>Brand</strong> - Product brand</li>
          <li>• <strong>Supplier</strong> - Supplier name</li>
        </ul>
      </div>
    </div>
  );
}
