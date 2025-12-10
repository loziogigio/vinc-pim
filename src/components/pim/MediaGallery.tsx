"use client";

import { useState, useEffect, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Upload,
  Trash2,
  FileText,
  Video,
  Box,
  File,
  Download,
  ChevronDown,
  Edit2,
  Check,
  X as XIcon,
  Maximize2,
  GripVertical,
  ExternalLink,
  Link as LinkIcon,
} from "lucide-react";

type MediaType = "document" | "video" | "3d-model";

interface MediaItem {
  _id?: string; // MongoDB ID - used as fallback when cdn_key is missing
  type: MediaType;
  file_type: string;
  url: string;
  cdn_key?: string; // May be missing for older uploads
  label?: string | Record<string, string>; // Can be string or MultilingualText object
  size_bytes?: number; // Optional for external links
  uploaded_at: string;
  is_external_link?: boolean; // true for URLs, false for uploads
  position: number; // Order within type group
}

/**
 * Get a unique identifier for a media item
 * Prefers cdn_key, falls back to _id, then URL
 */
function getMediaId(media: MediaItem): string {
  return media.cdn_key || media._id || media.url;
}

interface MediaGalleryProps {
  media: MediaItem[];
  onUpload: (files: File[], type: MediaType) => Promise<void>;
  onAddLink: (url: string, type: MediaType, label?: string) => Promise<void>;
  onDelete: (cdn_key: string) => Promise<void>;
  onLabelUpdate?: (cdn_key: string, newLabel: string) => Promise<void>;
  onReorder?: (type: MediaType, newOrder: string[]) => Promise<void>;
  disabled?: boolean;
}

/**
 * Convert label to string format
 * If label is MultilingualText object, extract default language (it, en, or first available)
 */
function getLabelAsString(label?: string | Record<string, string>): string {
  if (!label) return "Untitled";
  if (typeof label === "string") return label;
  // If it's an object (MultilingualText), try to get Italian, English, or first available
  return label.it || label.en || Object.values(label)[0] || "Untitled";
}

function getMediaIcon(type: MediaType, isExternalLink?: boolean) {
  if (isExternalLink) {
    return ExternalLink;
  }
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
      return "Documents";
    case "video":
      return "Videos";
    case "3d-model":
      return "3D Models";
    default:
      return "Files";
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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getMediaId(media), disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: 1,
  };

  const Icon = getMediaIcon(media.type, media.is_external_link);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editedLabel, setEditedLabel] = useState(getLabelAsString(media.label));
  const [showPreview, setShowPreview] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modelViewerLoaded, setModelViewerLoaded] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isModalModelLoading, setIsModalModelLoading] = useState(true);
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const modelViewerRef = useRef<any>(null);
  const modalModelViewerRef = useRef<any>(null);

  const canPreview =
    !media.is_external_link && (media.type === "video" || media.type === "3d-model" || media.type === "document");

  const handleSaveLabel = () => {
    const currentLabel = getLabelAsString(media.label);
    if (onLabelUpdate && editedLabel.trim() !== currentLabel) {
      onLabelUpdate(getMediaId(media), editedLabel.trim());
    }
    setIsEditingLabel(false);
  };

  const handleCancelLabel = () => {
    setEditedLabel(getLabelAsString(media.label));
    setIsEditingLabel(false);
  };

  const handleKeyDownLabel = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveLabel();
    } else if (e.key === "Escape") {
      e.preventDefault();
      handleCancelLabel();
    }
  };

  // Load model-viewer script if needed
  useEffect(() => {
    if (media.type === "3d-model" && !modelViewerLoaded && !media.is_external_link) {
      const script = document.createElement("script");
      script.type = "module";
      script.src =
        "https://ajax.googleapis.com/ajax/libs/model-viewer/3.3.0/model-viewer.min.js";
      script.onload = () => setModelViewerLoaded(true);
      script.onerror = () => {
        setModelLoadError("Failed to load 3D viewer library");
        setIsModelLoading(false);
        setIsModalModelLoading(false);
      };
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [media.type, media.is_external_link, modelViewerLoaded]);

  // Model loading handlers
  const handleModelLoad = () => {
    setIsModelLoading(false);
    setModelLoadError(null);
  };

  const handleModalModelLoad = () => {
    setIsModalModelLoading(false);
    setModelLoadError(null);
  };

  const handleModelError = (error: any) => {
    console.error("3D Model loading error:", error);
    setModelLoadError("Failed to load 3D model. The file may be corrupted or in an unsupported format.");
    setIsModelLoading(false);
  };

  const handleModalModelError = (error: any) => {
    console.error("3D Model loading error in modal:", error);
    setModelLoadError("Failed to load 3D model. The file may be corrupted or in an unsupported format.");
    setIsModalModelLoading(false);
  };

  useEffect(() => {
    if (modelViewerRef.current && media.type === "3d-model" && modelViewerLoaded && !media.is_external_link) {
      const viewer = modelViewerRef.current as any;
      viewer.addEventListener("load", handleModelLoad);
      viewer.addEventListener("error", handleModelError);

      return () => {
        viewer.removeEventListener("load", handleModelLoad);
        viewer.removeEventListener("error", handleModelError);
      };
    }
  }, [modelViewerLoaded, media.type, media.is_external_link]);

  useEffect(() => {
    if (
      modalModelViewerRef.current &&
      media.type === "3d-model" &&
      modelViewerLoaded &&
      showModal &&
      !media.is_external_link
    ) {
      const viewer = modalModelViewerRef.current as any;
      viewer.addEventListener("load", handleModalModelLoad);
      viewer.addEventListener("error", handleModalModelError);

      return () => {
        viewer.removeEventListener("load", handleModalModelLoad);
        viewer.removeEventListener("error", handleModalModelError);
      };
    }
  }, [modelViewerLoaded, media.type, showModal, media.is_external_link]);

  const renderPreview = () => {
    if (media.is_external_link) {
      // For external links, show a preview button that opens the link
      return (
        <div className="mt-2 p-3 bg-gray-50 rounded border border-gray-200">
          <a
            href={media.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </a>
        </div>
      );
    }

    if (media.type === "video") {
      return (
        <div className="mt-2">
          <video
            src={media.url}
            controls
            className="w-full max-h-64 rounded border border-gray-200"
          >
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }

    if (media.type === "3d-model") {
      if (!modelViewerLoaded) {
        return (
          <div className="mt-2 p-4 bg-gray-50 rounded border border-gray-200 text-center text-sm text-gray-600">
            Loading 3D viewer...
          </div>
        );
      }

      if (modelLoadError) {
        return (
          <div className="mt-2 p-4 bg-red-50 rounded border border-red-200 text-center text-sm text-red-600">
            {modelLoadError}
          </div>
        );
      }

      return (
        <div className="mt-2 relative">
          {isModelLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50 rounded border border-gray-200 z-10">
              <div className="text-sm text-gray-600">Loading 3D model...</div>
            </div>
          )}
          <model-viewer
            ref={modelViewerRef}
            src={media.url}
            alt={getLabelAsString(media.label) || "3D Model"}
            auto-rotate
            camera-controls
            style={{
              width: "100%",
              height: "300px",
              border: "1px solid #e5e7eb",
              borderRadius: "0.375rem",
            }}
          ></model-viewer>
        </div>
      );
    }

    if (media.type === "document") {
      // For PDF files, show an embedded viewer
      if (media.file_type === "application/pdf" || media.url.toLowerCase().endsWith(".pdf")) {
        return (
          <div className="mt-2">
            <iframe
              src={media.url}
              className="w-full h-96 rounded border border-gray-200"
              title={getLabelAsString(media.label) || "Document preview"}
            />
          </div>
        );
      }

      // For other document types, show a message
      return (
        <div className="mt-2 p-3 bg-blue-50 rounded border border-blue-200">
          <p className="text-sm text-blue-800">
            Preview not available for this document type. Click download to view the file.
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-2 p-3 bg-white border rounded-lg ${
        isDragging ? "shadow-lg z-50" : "shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        {disabled ? (
          <div className="p-1 cursor-not-allowed opacity-50">
            <GripVertical className="h-5 w-5 text-gray-400" />
          </div>
        ) : (
          <button
            type="button"
            className="p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-5 w-5 text-gray-400" />
          </button>
        )}

        {/* Icon */}
        <div className="flex-shrink-0">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${getMediaTypeBadgeColor(
              media.type
            )}`}
          >
            <Icon className="h-5 w-5" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Label - Editable */}
          {isEditingLabel ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editedLabel}
                onChange={(e) => setEditedLabel(e.target.value)}
                onKeyDown={handleKeyDownLabel}
                className="flex-1 px-2 py-1 text-sm font-medium border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter label"
                autoFocus
                disabled={disabled}
              />
              <button
                type="button"
                onClick={handleSaveLabel}
                disabled={disabled}
                className="p-1 text-green-600 hover:bg-green-50 rounded transition disabled:opacity-50"
                title="Save"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleCancelLabel}
                disabled={disabled}
                className="p-1 text-red-600 hover:bg-red-50 rounded transition disabled:opacity-50"
                title="Cancel"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900 truncate">
                {getLabelAsString(media.label)}
              </p>
              {onLabelUpdate && (
                <button
                  type="button"
                  onClick={() => setIsEditingLabel(true)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition disabled:opacity-50"
                  title="Edit label"
                >
                  <Edit2 className="h-3 w-3" />
                </button>
              )}
            </div>
          )}

          {/* File Info */}
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="truncate">{media.file_type}</span>
            {media.size_bytes && (
              <>
                <span>•</span>
                <span>{formatFileSize(media.size_bytes)}</span>
              </>
            )}
            {media.is_external_link && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  External Link
                </span>
              </>
            )}
          </div>

          {/* URL for external links */}
          {media.is_external_link && (
            <div className="mt-1">
              <a
                href={media.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline truncate block"
                title={media.url}
              >
                {media.url}
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {canPreview && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title={showPreview ? "Hide preview" : "Show preview"}
            >
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showPreview ? "rotate-180" : ""
                }`}
              />
            </button>
          )}

          {!media.is_external_link && (
            <>
              <a
                href={media.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Download"
              >
                <Download className="h-4 w-4" />
              </a>

              {media.type === "3d-model" && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  title="View fullscreen"
                >
                  <Maximize2 className="h-4 w-4" />
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={() => onDelete(getMediaId(media))}
            disabled={disabled}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preview */}
      {showPreview && canPreview && renderPreview()}
      {media.is_external_link && renderPreview()}

      {/* Fullscreen Modal for 3D Models */}
      {showModal && media.type === "3d-model" && !media.is_external_link && (
        <div
          className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <button
            type="button"
            onClick={() => setShowModal(false)}
            className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition z-10"
            title="Close preview"
          >
            <XIcon className="h-6 w-6 text-gray-900" />
          </button>
          <div
            className="relative w-full max-w-6xl h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {isModalModelLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg z-10">
                <div className="text-white">Loading 3D model...</div>
              </div>
            )}
            {modelLoadError ? (
              <div className="w-full h-full flex items-center justify-center bg-red-50 rounded-lg">
                <div className="text-center text-red-600">
                  <p className="font-medium">{modelLoadError}</p>
                </div>
              </div>
            ) : (
              <model-viewer
                ref={modalModelViewerRef}
                src={media.url}
                alt={getLabelAsString(media.label) || "3D Model"}
                auto-rotate
                camera-controls
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: "0.5rem",
                }}
              ></model-viewer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AddLinkDialog({
  type,
  onAdd,
  onCancel,
}: {
  type: MediaType;
  onAdd: (url: string, label: string) => void;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onAdd(url.trim(), label.trim() || undefined);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Add {getMediaTypeLabel(type).slice(0, -1)} Link
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={
                type === "video"
                  ? "https://youtube.com/watch?v=... or https://cdn.example.com/video.mp4"
                  : "https://cdn.example.com/file..."
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (optional)
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Enter a descriptive label"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Add Link
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function MediaGallery({
  media: initialMedia,
  onUpload,
  onAddLink,
  onDelete,
  onLabelUpdate,
  onReorder,
  disabled = false,
}: MediaGalleryProps) {
  const [media, setMedia] = useState(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showAddLinkDialog, setShowAddLinkDialog] = useState<MediaType | null>(
    null
  );

  // Sync local state when initialMedia prop changes (e.g., after upload)
  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  // Setup drag-and-drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement to start dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Group media by type
  const groupedMedia = {
    document: media.filter((m) => m.type === "document").sort((a, b) => a.position - b.position),
    video: media.filter((m) => m.type === "video").sort((a, b) => a.position - b.position),
    "3d-model": media.filter((m) => m.type === "3d-model").sort((a, b) => a.position - b.position),
  };

  // Update local state when props change
  useEffect(() => {
    setMedia(initialMedia);
  }, [initialMedia]);

  const handleDelete = async (mediaId: string) => {
    if (!confirm("Are you sure you want to delete this file?")) {
      return;
    }

    setDeleting(mediaId);
    try {
      await onDelete(mediaId);
      setMedia(media.filter((m) => getMediaId(m) !== mediaId));
    } catch (error) {
      console.error("Failed to delete media:", error);
      alert("Failed to delete file. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: MediaType
  ) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      await onUpload(files, type);
      e.target.value = "";
    } catch (error) {
      console.error("Failed to upload files:", error);
      alert("Failed to upload files. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleAddLink = async (url: string, label?: string) => {
    if (!showAddLinkDialog) return;

    try {
      await onAddLink(url, showAddLinkDialog, label);
      setShowAddLinkDialog(null);
    } catch (error) {
      console.error("Failed to add link:", error);
      alert("Failed to add link. Please try again.");
    }
  };

  const handleDragEnd = async (event: DragEndEvent, type: MediaType) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onReorder) {
      return;
    }

    const items = groupedMedia[type];
    const oldIndex = items.findIndex((item) => getMediaId(item) === active.id);
    const newIndex = items.findIndex((item) => getMediaId(item) === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newOrder = arrayMove(items, oldIndex, newIndex);

    // Optimistically update local state with new positions
    const updatedMedia = media.map((m) => {
      if (m.type !== type) return m;
      const newPosition = newOrder.findIndex((item) => getMediaId(item) === getMediaId(m));
      return newPosition >= 0 ? { ...m, position: newPosition } : m;
    });
    setMedia(updatedMedia);

    try {
      await onReorder(type, newOrder.map((m) => getMediaId(m)));
    } catch (error) {
      console.error("Failed to reorder:", error);
      // Revert on error
      setMedia(media);
    }
  };

  const renderMediaGroup = (type: MediaType, items: MediaItem[]) => {
    const Icon = getMediaIcon(type);
    const typeLabel = getMediaTypeLabel(type);
    const acceptTypes =
      type === "document"
        ? ".pdf,.doc,.docx,.txt,.xls,.xlsx"
        : type === "video"
        ? "video/*"
        : ".glb,.gltf";

    return (
      <div key={type} className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Icon className={`h-4 w-4 ${getMediaTypeBadgeColor(type).split(" ")[1]}`} />
            {typeLabel}
            <span className="text-xs font-normal text-gray-500">({items.length})</span>
          </h4>
          <div className="flex gap-2">
            {/* Upload Button */}
            <label
              className={`inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition cursor-pointer ${
                uploading || disabled ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Upload className="h-3 w-3" />
              Upload
              <input
                type="file"
                multiple
                accept={acceptTypes}
                onChange={(e) => handleFileChange(e, type)}
                disabled={uploading || disabled}
                className="hidden"
              />
            </label>

            {/* Add Link Button */}
            <button
              type="button"
              onClick={() => setShowAddLinkDialog(type)}
              disabled={uploading || disabled}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition disabled:opacity-50"
            >
              <LinkIcon className="h-3 w-3" />
              Add Link
            </button>
          </div>
        </div>

        {/* Items */}
        {items.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Icon className="h-8 w-8 mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-600 mb-1">No {typeLabel.toLowerCase()} yet</p>
            <p className="text-xs text-gray-500">Upload files or add links</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={(event) => handleDragEnd(event, type)}
          >
            <SortableContext
              items={items.map((item) => getMediaId(item))}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {items.map((item, index) => (
                  <MediaFileItem
                    key={getMediaId(item)}
                    media={item}
                    onDelete={handleDelete}
                    onLabelUpdate={onLabelUpdate}
                    disabled={disabled || uploading || deleting === getMediaId(item)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Additional Media</h3>
        {uploading && (
          <span className="text-sm text-blue-600">Uploading...</span>
        )}
      </div>

      {/* Media Groups */}
      {renderMediaGroup("document", groupedMedia.document)}
      {renderMediaGroup("video", groupedMedia.video)}
      {renderMediaGroup("3d-model", groupedMedia["3d-model"])}

      {/* Add Link Dialog */}
      {showAddLinkDialog && (
        <AddLinkDialog
          type={showAddLinkDialog}
          onAdd={handleAddLink}
          onCancel={() => setShowAddLinkDialog(null)}
        />
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
