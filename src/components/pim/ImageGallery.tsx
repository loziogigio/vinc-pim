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
import { toast } from "sonner";
import { ProductImage } from "@/lib/types/pim";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  const { t } = useTranslation();
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
          {t("pages.pim.imageGallery.primary")}
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
              title={t("pages.pim.imageGallery.setPrimary")}
            >
              <Star className="h-3 w-3" />
              {t("pages.pim.imageGallery.setPrimary")}
            </button>
          )}

          {/* Delete Button */}
          <button
            type="button"
            onClick={() => onDelete(image.cdn_key)}
            disabled={disabled}
            className={`${onSetPrimary && !isPrimary ? '' : 'flex-1'} flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500 text-white text-xs font-medium rounded hover:bg-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed`}
            title={t("pages.pim.imageGallery.delete")}
          >
            <Trash2 className="h-3 w-3" />
            {t("pages.pim.imageGallery.delete")}
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
  const { t } = useTranslation();
  const [images, setImages] = useState(initialImages);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settingPrimary, setSettingPrimary] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<ProductImage | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

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

  const handleDeleteClick = (s3_key: string) => {
    setDeleteConfirm(s3_key);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    const s3_key = deleteConfirm;
    setDeleteConfirm(null);
    setDeleting(s3_key);
    try {
      await onDelete(s3_key);
      setImages(images.filter((img) => img.cdn_key !== s3_key));
      toast.success(t("pages.pim.imageGallery.deleteSuccess"));
    } catch (error) {
      console.error("Failed to delete image:", error);
      toast.error(t("pages.pim.imageGallery.deleteError"));
    } finally {
      setDeleting(null);
    }
  };

  const handleSetPrimary = async (s3_key: string) => {
    if (!onSetPrimary) return;

    setSettingPrimary(s3_key);
    try {
      await onSetPrimary(s3_key);
      toast.success(t("pages.pim.imageGallery.primaryUpdated"));
    } catch (error) {
      console.error("Failed to set primary image:", error);
      toast.error(t("pages.pim.imageGallery.primaryError"));
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
      e.target.value = "";
      toast.success(t("pages.pim.imageGallery.uploadSuccess", { count: String(files.length) }));
    } catch (error) {
      console.error("Failed to upload images:", error);
      toast.error(t("pages.pim.imageGallery.uploadError"));
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
          {t("pages.pim.imageGallery.title")}
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
          {uploading ? t("pages.pim.imageGallery.uploading") : t("pages.pim.imageGallery.uploadImages")}
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
          <p className="text-gray-600 mb-2">{t("pages.pim.imageGallery.noImages")}</p>
          <p className="text-sm text-gray-500">
            {t("pages.pim.imageGallery.uploadHint")}
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
                  onDelete={handleDeleteClick}
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
          <p className="font-medium text-blue-900 mb-1">{t("pages.pim.imageGallery.guideTitle")}</p>
          <ul className="space-y-1">
            <li>• <strong>{t("pages.pim.imageGallery.guidePos1")}</strong></li>
            <li>• <strong>{t("pages.pim.imageGallery.guideDrag")}</strong></li>
            <li>• <strong>{t("pages.pim.imageGallery.guideSetPrimary")}</strong></li>
            <li>• <strong>{t("pages.pim.imageGallery.guidePreview")}</strong></li>
          </ul>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteConfirm}
        title={t("pages.pim.imageGallery.deleteDialogTitle")}
        message={t("pages.pim.imageGallery.deleteDialogMessage")}
        confirmText={t("pages.pim.imageGallery.delete")}
        cancelText={t("common.cancel")}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />

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
