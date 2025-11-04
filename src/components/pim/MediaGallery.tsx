"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Trash2, FileText, Video, Box, File, Download, ChevronDown, ChevronUp, Edit2, Check, X as XIcon, Maximize2 } from "lucide-react";

type MediaType = "document" | "video" | "3d-model";

interface MediaItem {
  type: MediaType;
  file_type: string;
  url: string;
  cdn_key: string;
  label?: string;
  size_bytes: number;
  uploaded_at: string;
}

interface MediaGalleryProps {
  media: MediaItem[];
  onUpload: (files: File[]) => Promise<void>;
  onDelete: (cdn_key: string) => Promise<void>;
  onLabelUpdate?: (cdn_key: string, newLabel: string) => Promise<void>;
  disabled?: boolean;
}

function getMediaIcon(type: MediaType) {
  switch (type) {
    case "document":
      return FileText;
    case "video":
      return Video;
    case "3d-model":
      return Box;
    default:
      return File;
  }
}

function getMediaTypeLabel(type: MediaType): string {
  switch (type) {
    case "document":
      return "Document";
    case "video":
      return "Video";
    case "3d-model":
      return "3D Model";
    default:
      return "File";
  }
}

function getMediaTypeBadgeColor(type: MediaType): string {
  switch (type) {
    case "document":
      return "bg-blue-100 text-blue-700";
    case "video":
      return "bg-purple-100 text-purple-700";
    case "3d-model":
      return "bg-green-100 text-green-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function MediaFileItem({
  media,
  onDelete,
  onLabelUpdate,
  disabled,
}: {
  media: MediaItem;
  onDelete: (cdn_key: string) => void;
  onLabelUpdate?: (cdn_key: string, newLabel: string) => void;
  disabled?: boolean;
}) {
  const Icon = getMediaIcon(media.type);
  const [showPreview, setShowPreview] = useState(media.type === "video" || media.type === "3d-model");
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(media.label || "Untitled");
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isModalModelLoading, setIsModalModelLoading] = useState(true);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const modelViewerRef = useRef<HTMLElement>(null);
  const modalModelViewerRef = useRef<HTMLElement>(null);

  const canPreview = media.type === "video" || media.type === "3d-model";

  const handleSaveLabel = () => {
    if (onLabelUpdate && editedLabel.trim() !== media.label) {
      onLabelUpdate(media.cdn_key, editedLabel.trim());
    }
    setIsEditingLabel(false);
  };

  const handleCancelEdit = () => {
    setEditedLabel(media.label || "Untitled");
    setIsEditingLabel(false);
  };

  // Dynamically load model-viewer only on client side and when needed
  useEffect(() => {
    if (media.type === "3d-model" && typeof window !== "undefined") {
      // Dynamically import model-viewer only on client side
      if (!customElements.get("model-viewer")) {
        import("@google/model-viewer")
          .then(() => {
            console.log("✅ model-viewer loaded successfully");
            setModelViewerLoaded(true);
          })
          .catch((error) => {
            console.error("❌ Failed to load model-viewer:", error);
            setModelLoadError("Failed to load 3D viewer library");
          });
      } else {
        setModelViewerLoaded(true);
      }
    }
  }, [media.type]);

  // Listen for model load events (preview)
  useEffect(() => {
    const modelViewer = modelViewerRef.current;
    if (!modelViewer) return;

    const handleLoad = () => {
      console.log("✅ 3D model loaded successfully (preview)");
      setIsModelLoading(false);
    };

    const handleError = (event: any) => {
      console.error("❌ 3D model loading error:", event);
      setModelLoadError("Failed to load 3D model file. The file may be corrupted or inaccessible.");
      setIsModelLoading(false);
    };

    // Add event listeners
    modelViewer.addEventListener("load", handleLoad);
    modelViewer.addEventListener("error", handleError);

    // Cleanup
    return () => {
      modelViewer.removeEventListener("load", handleLoad);
      modelViewer.removeEventListener("error", handleError);
    };
  }, [modelViewerLoaded]);

  // Listen for modal model load events
  useEffect(() => {
    const modalViewer = modalModelViewerRef.current;
    if (!modalViewer || !showModal) return;

    const handleLoad = () => {
      console.log("✅ 3D model loaded successfully (modal)");
      setIsModalModelLoading(false);
    };

    const handleError = (event: any) => {
      console.error("❌ Modal 3D model loading error:", event);
      setIsModalModelLoading(false);
    };

    // Add event listeners
    modalViewer.addEventListener("load", handleLoad);
    modalViewer.addEventListener("error", handleError);

    // Cleanup
    return () => {
      modalViewer.removeEventListener("load", handleLoad);
      modalViewer.removeEventListener("error", handleError);
    };
  }, [showModal, modelViewerLoaded]);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!showModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showModal]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [showModal]);

  return (
    <div
      className={`
        bg-white border rounded-lg shadow-sm overflow-hidden
        ${disabled ? "opacity-60" : ""}
      `}
    >
      {/* Header with file info */}
      <div className="flex items-center gap-3 p-3">
        {/* Icon */}
        <div className="flex-shrink-0 w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isEditingLabel ? (
              <div className="flex items-center gap-1 flex-1">
                <input
                  type="text"
                  value={editedLabel}
                  onChange={(e) => setEditedLabel(e.target.value)}
                  className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:border-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveLabel();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                />
                <button
                  type="button"
                  onClick={handleSaveLabel}
                  className="p-1 text-green-600 hover:bg-green-50 rounded"
                  title="Save"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="p-1 text-red-600 hover:bg-red-50 rounded"
                  title="Cancel"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm font-medium text-gray-900 truncate">
                  {media.label || "Untitled"}
                </p>
                {onLabelUpdate && (
                  <button
                    type="button"
                    onClick={() => setIsEditingLabel(true)}
                    className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                    title="Edit label"
                    disabled={disabled}
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getMediaTypeBadgeColor(
                media.type
              )}`}
            >
              {getMediaTypeLabel(media.type)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>{formatFileSize(media.size_bytes)}</span>
            <span>•</span>
            <span>{getFileExtension(media.label || "").toUpperCase()}</span>
            <span>•</span>
            <span>{new Date(media.uploaded_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {canPreview && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              {showPreview ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
          <a
            href={media.url}
            download
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={() => onDelete(media.cdn_key)}
            disabled={disabled}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete file"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {showPreview && canPreview && (
        <div className="border-t bg-gray-50 p-4">
          {media.type === "video" && (
            <video
              controls
              className="w-full max-h-96 rounded-lg bg-black"
              preload="metadata"
              onError={(e) => {
                console.error("Video loading error:", e);
                const video = e.target as HTMLVideoElement;
                if (video.parentElement) {
                  video.parentElement.innerHTML = `
                    <div class="w-full h-64 rounded-lg bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center text-center p-6">
                      <div class="text-red-900 font-semibold mb-2">Failed to Load Video</div>
                      <div class="text-sm text-red-700">The video file may be corrupted or in an unsupported format.</div>
                      <a href="${media.url}" download class="mt-3 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">Download File</a>
                    </div>
                  `;
                }
              }}
            >
              <source src={media.url} type={`video/${getFileExtension(media.label || "mp4")}`} />
              Your browser does not support the video tag.
            </video>
          )}

          {media.type === "3d-model" && (
            <div className="relative">
              {modelLoadError ? (
                <div className="w-full h-96 rounded-lg bg-red-50 border-2 border-red-200 flex flex-col items-center justify-center text-center p-6">
                  <Box className="h-16 w-16 text-red-400 mb-3" />
                  <h4 className="text-lg font-semibold text-red-900 mb-2">Failed to Load 3D Viewer</h4>
                  <p className="text-sm text-red-700 mb-4">{modelLoadError}</p>
                  <a
                    href={media.url}
                    download
                    className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded hover:bg-red-700 transition"
                  >
                    <Download className="h-4 w-4" />
                    Download 3D Model
                  </a>
                </div>
              ) : !modelViewerLoaded ? (
                <div className="w-full h-96 rounded-lg bg-gray-100 flex flex-col items-center justify-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-3"></div>
                  <p className="text-sm text-gray-600">Loading 3D viewer...</p>
                </div>
              ) : (
                <div className="relative">
                  <model-viewer
                    ref={modelViewerRef as any}
                    src={media.url}
                    alt={media.label || "3D Model"}
                    auto-rotate
                    camera-controls
                    shadow-intensity="1"
                    style={{
                      width: "100%",
                      height: "400px",
                      backgroundColor: "#f3f4f6",
                      borderRadius: "0.5rem",
                    }}
                    className="rounded-lg"
                  />
                  {isModelLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-90 rounded-lg">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-3"></div>
                        <p className="text-sm text-gray-600">Loading 3D model...</p>
                      </div>
                    </div>
                  )}
                  {/* Maximize button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(true);
                      setIsModalModelLoading(true);
                    }}
                    className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md transition-all hover:shadow-lg"
                    title="View fullscreen"
                  >
                    <Maximize2 className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Modal */}
      {showModal && modelViewerLoaded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="relative w-full h-full max-w-7xl max-h-[90vh] m-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 z-10 p-2 bg-white/90 hover:bg-white rounded-lg shadow-lg transition-all"
              title="Close (ESC)"
            >
              <XIcon className="h-6 w-6 text-gray-700" />
            </button>

            {/* Modal content */}
            <div className="w-full h-full bg-gray-100 rounded-lg shadow-2xl overflow-hidden">
              <model-viewer
                ref={modalModelViewerRef as any}
                src={media.url}
                alt={media.label || "3D Model"}
                auto-rotate
                camera-controls
                shadow-intensity="1"
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundColor: "#f3f4f6",
                }}
              />
              {isModalModelLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                  <div className="flex flex-col items-center bg-white/90 p-6 rounded-lg">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-sm text-gray-700 font-medium">Loading 3D model...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Model info */}
            <div className="absolute bottom-4 left-4 bg-white/90 px-4 py-2 rounded-lg shadow-lg">
              <p className="text-sm font-semibold text-gray-900">{media.label || "3D Model"}</p>
              <p className="text-xs text-gray-600">{formatFileSize(media.size_bytes)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MediaGallery({
  media: initialMedia,
  onUpload,
  onDelete,
  onLabelUpdate,
  disabled = false,
}: MediaGalleryProps) {
  const [media, setMedia] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (cdn_key: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    setDeleting(cdn_key);
    try {
      await onDelete(cdn_key);
      setMedia(media.filter((m) => m.cdn_key !== cdn_key));
    } catch (error) {
      console.error("Failed to delete media:", error);
      alert("Failed to delete file. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handleLabelUpdate = async (cdn_key: string, newLabel: string) => {
    if (!onLabelUpdate) return;

    try {
      await onLabelUpdate(cdn_key, newLabel);
      // Update local state
      setMedia(media.map((m) => (m.cdn_key === cdn_key ? { ...m, label: newLabel } : m)));
    } catch (error) {
      console.error("Failed to update label:", error);
      alert("Failed to update label. Please try again.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      await onUpload(files);
      // Clear the input
      e.target.value = "";
    } catch (error) {
      console.error("Failed to upload media:", error);
      alert("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Group media by type
  const mediaByType = media.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<MediaType, MediaItem[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <File className="h-5 w-5" />
          Additional Media
        </h3>
        <label
          className={`
            inline-flex items-center gap-2 px-4 py-2
            bg-blue-600 text-white text-sm font-medium rounded-lg
            hover:bg-blue-700 transition cursor-pointer
            ${uploading || disabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <Upload className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Files"}
          <input
            type="file"
            multiple
            accept=".txt,.csv,.pdf,.xls,.xlsx,.mp4,.webm,.mov,.glb,.gltf,.obj,.fbx"
            onChange={handleFileChange}
            disabled={uploading || disabled}
            className="hidden"
          />
        </label>
      </div>

      {/* File type info */}
      <div className="text-xs text-gray-600 bg-gray-50 rounded p-3">
        <p className="font-semibold mb-1">Supported file types:</p>
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          <li>
            <span className="font-medium">Documents:</span> txt, csv, pdf, xlsx
            (max 10MB)
          </li>
          <li>
            <span className="font-medium">Videos:</span> mp4, webm, mov (max
            100MB)
          </li>
          <li>
            <span className="font-medium">3D Models:</span> glb, gltf, obj, fbx
            (max 50MB)
          </li>
        </ul>
      </div>

      {/* Gallery */}
      {media.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <File className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-2">No media files uploaded yet</p>
          <p className="text-sm text-gray-500">
            Click &quot;Upload Files&quot; to add documents, videos, or 3D
            models
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(mediaByType).map(([type, items]) => (
            <div key={type}>
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                {getMediaTypeLabel(type as MediaType)}
                <span className="text-xs font-normal text-gray-500">
                  ({items.length})
                </span>
              </h4>
              <div className="space-y-2">
                {items.map((item) => (
                  <MediaFileItem
                    key={item.cdn_key}
                    media={item}
                    onDelete={handleDelete}
                    onLabelUpdate={onLabelUpdate ? handleLabelUpdate : undefined}
                    disabled={disabled || uploading || deleting === item.cdn_key}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}
