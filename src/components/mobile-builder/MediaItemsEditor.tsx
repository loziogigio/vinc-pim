"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, useCallback } from "react";
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
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Upload,
  Link2,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Video,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { MediaItem } from "@/lib/types/mobile-builder";

interface MediaItemsEditorProps {
  items: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  maxItems?: number;
}

// Sortable item component
function SortableMediaItem({
  item,
  index,
  onDelete,
  onUpdate,
}: {
  item: MediaItem;
  index: number;
  onDelete: () => void;
  onUpdate: (updates: Partial<MediaItem>) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.media_url || `item-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3"
    >
      {/* Drag handle */}
      <button
        type="button"
        className="cursor-grab p-1 text-muted-foreground active:cursor-grabbing hover:text-foreground"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Thumbnail */}
      <div className="relative h-12 w-12 min-h-[48px] min-w-[48px] max-h-[48px] max-w-[48px] flex-shrink-0 overflow-hidden rounded bg-muted">
        {item.media_url ? (
          item.media_type === "video" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-muted">
              <Video className="h-5 w-5 text-muted-foreground" />
            </div>
          ) : (
            <img
              src={item.media_url}
              alt={item.alt_text || "Media"}
              className="absolute inset-0 w-full h-full object-cover"
            />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <input
          type="text"
          value={item.alt_text || ""}
          onChange={(e) => onUpdate({ alt_text: e.target.value })}
          placeholder="Alt text / Title"
          className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <input
          type="text"
          value={item.link_url || ""}
          onChange={(e) => onUpdate({ link_url: e.target.value })}
          placeholder="Link URL (optional)"
          className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 dark:hover:text-red-400"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// Add media modal
function AddMediaModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: MediaItem) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      setError(null);

      try {
        const formData = new FormData();
        formData.append("image", file);

        const response = await fetch("/api/b2b/editor/upload-image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        const uploadedUrl = data.url || data.imageUrl;

        if (!uploadedUrl) {
          throw new Error("No URL returned from upload");
        }

        onAdd({
          media_url: uploadedUrl,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          alt_text: file.name.replace(/\.[^/.]+$/, ""),
        });
        onClose();
      } catch (err) {
        setError("Failed to upload file. Please try again.");
        console.error("Upload error:", err);
      } finally {
        setIsUploading(false);
      }
    },
    [onAdd, onClose]
  );

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }

    onAdd({
      media_url: urlInput.trim(),
      media_type: mediaType,
      alt_text: "",
    });
    setUrlInput("");
    onClose();
  }, [urlInput, mediaType, onAdd, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-card shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="font-semibold text-foreground">Add Media</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 hover:bg-muted"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Mode tabs */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => {
                setMode("upload");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                mode === "upload"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-border hover:bg-accent"
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>Upload</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("url");
                setError(null);
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md border transition-colors ${
                mode === "url"
                  ? "bg-primary/10 border-primary text-primary"
                  : "bg-card border-border text-muted-foreground hover:border-border hover:bg-accent"
              }`}
            >
              <Link2 className="h-4 w-4" />
              <span>URL</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600 dark:border-red-800 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          {mode === "upload" ? (
            <div className="space-y-4">
              <label
                className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                  isUploading
                    ? "border-border bg-muted"
                    : "border-border hover:border-primary hover:bg-primary/5"
                }`}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <span className="mt-2 text-sm text-muted-foreground">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                    <span className="mt-2 text-sm text-muted-foreground">
                      Click to upload image or video
                    </span>
                    <span className="mt-1 text-xs text-muted-foreground/70">
                      PNG, JPG, GIF, MP4 up to 10MB
                    </span>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Media Type</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setMediaType("image")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
                      mediaType === "image"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    <ImageIcon className="h-4 w-4" />
                    Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setMediaType("video")}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded border text-sm ${
                      mediaType === "video"
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    <Video className="h-4 w-4" />
                    Video
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-sm">URL</Label>
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="mt-1"
                />
              </div>

              <Button onClick={handleUrlSubmit} className="w-full">
                Add Media
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MediaItemsEditor({
  items,
  onChange,
  maxItems = 20,
}: MediaItemsEditorProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = items.findIndex(
          (item, i) => (item.media_url || `item-${i}`) === active.id
        );
        const newIndex = items.findIndex(
          (item, i) => (item.media_url || `item-${i}`) === over.id
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          onChange(arrayMove(items, oldIndex, newIndex));
        }
      }
    },
    [items, onChange]
  );

  const handleAddItem = useCallback(
    (item: MediaItem) => {
      if (items.length < maxItems) {
        onChange([...items, item]);
      }
    },
    [items, maxItems, onChange]
  );

  const handleDeleteItem = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(newItems);
    },
    [items, onChange]
  );

  const handleUpdateItem = useCallback(
    (index: number, updates: Partial<MediaItem>) => {
      const newItems = items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      );
      onChange(newItems);
    },
    [items, onChange]
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">
          Media Items ({items.length}/{maxItems})
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsModalOpen(true)}
          disabled={items.length >= maxItems}
          className="h-7 px-2 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Media
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/30 py-8">
          <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">No media items yet</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="mt-2"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add your first media
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((item, i) => item.media_url || `item-${i}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {items.map((item, index) => (
                <SortableMediaItem
                  key={item.media_url || `item-${index}`}
                  item={item}
                  index={index}
                  onDelete={() => handleDeleteItem(index)}
                  onUpdate={(updates) => handleUpdateItem(index, updates)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <AddMediaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddItem}
      />
    </div>
  );
}
