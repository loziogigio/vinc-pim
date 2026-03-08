"use client";

import { useState, useRef, DragEvent } from "react";
import { Upload, Image as ImageIcon, X, Link as LinkIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  label: string;
  disabled?: boolean;
}

export function ImageUpload({ value, onChange, label, disabled }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/b2b/editor/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const data = await response.json();
      onChange(data.url);
      toast.success("Image uploaded successfully");
    } catch (error) {
      console.error("Image upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleUrlSubmit = () => {
    if (urlInput.trim()) {
      onChange(urlInput.trim());
      setUrlInput("");
      setShowUrlInput(false);
      toast.success("Image URL added");
    }
  };

  const handleRemove = () => {
    onChange("");
    setUrlInput("");
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground mb-1">
        {label}
      </label>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Drop zone or preview */}
      {!value ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative rounded-lg border-2 border-dashed p-6 transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/30"
          } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
        >
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
              {isUploading ? (
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              ) : (
                <ImageIcon className="h-6 w-6 text-primary" />
              )}
            </div>
            <h3 className="mb-1 text-sm font-semibold">
              {isUploading ? "Uploading..." : "Upload Image"}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              Drag and drop your image here, or
            </p>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 text-xs bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
              >
                <Upload className="inline h-3 w-3 mr-1" />
                Browse
              </button>
              <span className="text-xs text-muted-foreground">or</span>
              <button
                type="button"
                onClick={() => setShowUrlInput(!showUrlInput)}
                disabled={disabled || isUploading}
                className="px-3 py-1.5 text-xs border border-border rounded hover:bg-muted transition disabled:opacity-50"
              >
                <LinkIcon className="inline h-3 w-3 mr-1" />
                Enter URL
              </button>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              PNG, JPG, GIF up to 5MB
            </p>
          </div>
        </div>
      ) : (
        <div className="relative">
          <img
            src={value}
            alt="Preview"
            className="w-full h-auto max-h-60 rounded-lg border border-border object-contain bg-muted/30"
            onError={(e) => {
              e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%23ddd' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%23999'%3EInvalid Image%3C/text%3E%3C/svg%3E";
            }}
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition disabled:opacity-50"
            title="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* URL Input Section */}
      {showUrlInput && !value && (
        <div className="flex gap-2 p-3 bg-muted/30 rounded-lg border border-border">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 rounded border border-border bg-white px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleUrlSubmit();
              }
            }}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            disabled={!urlInput.trim() || disabled}
            className="px-3 py-1.5 text-sm bg-primary text-white rounded hover:bg-primary/90 transition disabled:opacity-50"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setShowUrlInput(false);
              setUrlInput("");
            }}
            disabled={disabled}
            className="px-3 py-1.5 text-sm border border-border rounded hover:bg-muted transition"
          >
            Cancel
          </button>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Upload an image file or enter a URL
      </p>
    </div>
  );
}
