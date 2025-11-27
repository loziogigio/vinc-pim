"use client";

import { useState, useEffect } from "react";
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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Upload, Image as ImageIcon, X, ZoomIn, Star } from "lucide-react";
import { ProductImage } from "@/lib/types/pim";

interface ImageGalleryProps {
  images: ProductImage[];
  onReorder: (newOrder: string[]) => Promise<void>;
  onDelete: (cdn_key: string) => Promise<void>;
  onUpload: (files: File[]) => Promise<void>;
  onSetPrimary?: (cdn_key: string) => Promise<void>;
  primaryImageKey?: string;
  disabled?: boolean;
}

function SortableImageItem({
  image,
  onDelete,
  onPreview,
  onSetPrimary,
  isPrimary,
  disabled,
}: {
  image: ProductImage;
  onDelete: (cdn_key: string) => void;
  onPreview: (image: ProductImage) => void;
  onSetPrimary?: (cdn_key: string) => void;
  isPrimary?: boolean;
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
        relative bg-white border-2 rounded-lg overflow-hidden
        ${isDragging ? "shadow-2xl z-50 border-blue-400" : "shadow-md border-gray-200"}
        ${isPrimary ? "ring-2 ring-yellow-400" : ""}
        ${disabled ? "opacity-60" : ""}
      `}
    >
      {/* Position Badge */}
      <div className="absolute top-2 left-2 z-10 bg-gray-900 bg-opacity-75 text-white text-xs font-bold px-2 py-1 rounded">
        #{image.position + 1}
      </div>

      {/* Primary Badge */}
      {isPrimary && (
        <div className="absolute top-2 right-2 z-10 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
          <Star className="h-3 w-3 fill-current" />
          PRIMARY
        </div>
      )}

      {/* Drag Handle */}
      <div
        className="absolute top-2 left-1/2 transform -translate-x-1/2 z-10 cursor-grab active:cursor-grabbing bg-white bg-opacity-90 rounded-full p-1 shadow-md"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4 text-gray-600" />
      </div>

      {/* Image Preview - Clickable */}
      <button
        type="button"
        onClick={() => onPreview(image)}
        className="w-full aspect-square bg-gray-100 relative group"
      >
        <img
          src={image.url}
          alt={image.file_name || "Product image"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition flex items-center justify-center">
          <ZoomIn className="h-8 w-8 text-white opacity-0 group-hover:opacity-100 transition" />
        </div>
      </button>

      {/* Image Info Footer */}
      <div className="p-3 bg-gray-50">
        <p className="text-xs font-medium text-gray-900 truncate mb-1">
          {image.file_name || "Untitled"}
        </p>
        {image.size_bytes && (
          <p className="text-xs text-gray-500 mb-2">
            {formatFileSize(image.size_bytes)}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          {/* Set as Primary Button */}
          {onSetPrimary && !isPrimary && (
            <button
              type="button"
              onClick={() => onSetPrimary(image.cdn_key)}
              disabled={disabled}
              className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-yellow-500 text-white text-xs font-medium rounded hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              title="Set as primary image"
            >
              <Star className="h-3 w-3" />
              Set Primary
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onDelete(image.cdn_key)}
            disabled={disabled}
            className={`${onSetPrimary && !isPrimary ? '' : 'flex-1'} flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed`}
            title="Delete image"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function ImageGallery({
  images: initialImages,
  onReorder,
  onDelete,
  onUpload,
  onSetPrimary,
  primaryImageKey,
  disabled = false,
}: ImageGalleryProps) {
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ProductImage | null>(null);

  // Sync local state when initialImages prop changes (e.g., after upload)
  useEffect(() => {
    setImages(initialImages);
  }, [initialImages]);

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

  const handleDelete = async (s3_key: string) => {
    if (!confirm("Are you sure you want to delete this image?")) {
      return;
    }

    setDeleting(s3_key);
    try {
      await onDelete(s3_key);
      setImages(images.filter((img) => img.cdn_key !== s3_key));
    } catch (error) {
      console.error("Failed to delete image:", error);
      alert("Failed to delete image. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handleSetPrimary = async (s3_key: string) => {
    if (!onSetPrimary) return;

    setSettingPrimary(s3_key);
    try {
      await onSetPrimary(s3_key);
    } catch (error) {
      console.error("Failed to set primary image:", error);
      alert("Failed to set primary image. Please try again.");
    } finally {
      setSettingPrimary(null);
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
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <SortableImageItem
                  key={image.cdn_key || image._id || `image-${index}`}
                  image={image}
                  onDelete={handleDelete}
                  onPreview={setPreviewImage}
                  onSetPrimary={onSetPrimary ? handleSetPrimary : undefined}
                  isPrimary={primaryImageKey === image.cdn_key || image.position === 0}
                  disabled={disabled || uploading || deleting === image.cdn_key || settingPrimary === image.cdn_key}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Help Text */}
      <div className="flex items-start gap-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <ImageIcon className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-blue-900 mb-1">Image Management Guide:</p>
          <ul className="space-y-1">
            <li>• <strong>Position #{'\u0023'}1</strong> is always the primary/main product image</li>
            <li>• <strong>Drag</strong> the handle at the top to reorder images</li>
            <li>• Click <strong>"Set Primary"</strong> to move any image to position #1</li>
            <li>• Click on an image to <strong>preview</strong> it in full screen</li>
          </ul>
        </div>
      </div>

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
