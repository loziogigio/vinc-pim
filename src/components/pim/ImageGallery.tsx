"use client";

import { useState } from "react";
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
import { GripVertical, Trash2, Upload, Image as ImageIcon, X, ZoomIn } from "lucide-react";

interface ImageItem {
  url: string;
  cdn_key: string;
  position: number;
  file_name?: string;
  size_bytes?: number;
}

interface ImageGalleryProps {
  images: ImageItem[];
  onReorder: (newOrder: string[]) => Promise<void>;
  onDelete: (cdn_key: string) => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  disabled?: boolean;
}

function SortableImageItem({
  image,
  onDelete,
  onPreview,
  disabled,
}: {
  image: ImageItem;
  onDelete: (cdn_key: string) => void;
  onPreview: (image: ImageItem) => void;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.cdn_key, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-3 p-3 bg-white border rounded-lg
        ${isDragging ? "shadow-lg z-50" : "shadow-sm"}
        ${disabled ? "opacity-60" : ""}
      `}
    >
      {/* Drag Handle */}
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
        {...attributes}
        {...listeners}
        disabled={disabled}
      >
        <GripVertical className="h-5 w-5 text-gray-400" />
      </button>

      {/* Image Preview - Clickable */}
      <button
        type="button"
        onClick={() => onPreview(image)}
        className="w-16 h-16 flex-shrink-0 bg-gray-100 rounded overflow-hidden relative group"
      >
        <img
          src={image.url}
          alt={image.file_name || "Product image"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition flex items-center justify-center">
          <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
      </button>

      {/* Image Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {image.file_name || "Untitled"}
        </p>
        {image.size_bytes && (
          <p className="text-xs text-gray-500">
            {formatFileSize(image.size_bytes)}
          </p>
        )}
      </div>

      {/* Delete Button */}
      <button
        type="button"
        onClick={() => onDelete(image.cdn_key)}
        disabled={disabled}
        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
        title="Delete image"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ImageGallery({
  images: initialImages,
  onReorder,
  onDelete,
  onUpload,
  disabled = false,
}: ImageGalleryProps) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ImageItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = images.findIndex((img) => img.cdn_key === active.id);
      const newIndex = images.findIndex((img) => img.cdn_key === over.id);

      const newOrder = arrayMove(images, oldIndex, newIndex);
      setImages(newOrder);

      try {
        await onReorder(newOrder.map((img) => img.cdn_key));
      } catch (error) {
        // Revert on error
        setImages(images);
        console.error("Failed to reorder images:", error);
      }
    }
  };

  const handleDelete = async (cdn_key: string) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    setDeleting(cdn_key);
    try {
      await onDelete(cdn_key);
      setImages(images.filter((img) => img.cdn_key !== cdn_key));
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image. Please try again.");
    } finally {
      setDeleting(null);
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
      console.error("Failed to upload images:", error);
      alert("Failed to upload images. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Product Images
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
          {uploading ? "Uploading..." : "Upload Images"}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={uploading || disabled}
            className="hidden"
          />
        </label>
      </div>

      {/* Gallery */}
      {images.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ImageIcon className="h-12 w-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600 mb-2">No images uploaded yet</p>
          <p className="text-sm text-gray-500">
            Click &quot;Upload Images&quot; to add product images
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={images.map((img) => img.cdn_key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {images.map((image) => (
                <SortableImageItem
                  key={image.cdn_key}
                  image={image}
                  onDelete={handleDelete}
                  onPreview={setPreviewImage}
                  disabled={disabled || uploading || deleting === image.cdn_key}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Help Text */}
      <p className="text-xs text-gray-500">
        Drag and drop images to reorder them. The first image will be the main
        product image.
      </p>

      {/* Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute top-4 right-4 p-2 bg-white rounded-full hover:bg-gray-100 transition"
            title="Close preview"
          >
            <X className="h-6 w-6 text-gray-900" />
          </button>
          <div className="max-w-7xl max-h-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={previewImage.url}
              alt={previewImage.file_name || "Product image"}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            {previewImage.file_name && (
              <p className="text-white text-center mt-4 text-sm">
                {previewImage.file_name}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
