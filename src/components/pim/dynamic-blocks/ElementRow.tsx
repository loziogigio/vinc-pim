"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, Image as ImageIcon, Video, Box, Type, ExternalLink } from "lucide-react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { BlockElement, BlockElementKind, MediaElement, TextElement } from "@/lib/types/dynamic-blocks";
import { normalizeUrl } from "@/lib/validation/dynamic-blocks";
import { MediaInput } from "./MediaInput";

interface ElementRowProps {
  entityCode: string;
  element: BlockElement;
  onChange: (element: BlockElement) => void;
  onDelete: (id: string) => void;
  disabled?: boolean;
}

const KIND_OPTIONS: { kind: BlockElementKind; icon: typeof ImageIcon }[] = [
  { kind: "image", icon: ImageIcon },
  { kind: "video", icon: Video },
  { kind: "3d", icon: Box },
  { kind: "text", icon: Type },
];

/** Rebuild an element when its kind changes, preserving id/link/description. */
function changeKind(element: BlockElement, kind: BlockElementKind): BlockElement {
  const base = { id: element.id, link: element.link, description: element.description };
  if (kind === "text") {
    return { ...base, kind: "text", text: element.kind === "text" ? element.text : "" };
  }
  const media = element.kind === "text" ? { url: "" } : element.media;
  return { ...base, kind, media };
}

export function ElementRow({ entityCode, element, onChange, onDelete, disabled }: ElementRowProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: element.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const link = element.link;

  function patchLink(patch: Partial<{ href: string; new_tab: boolean }>) {
    const next = { href: link?.href ?? "", new_tab: link?.new_tab ?? false, ...patch };
    if (!next.href) {
      onChange({ ...element, link: undefined });
    } else {
      onChange({ ...element, link: next });
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex flex-col gap-3 rounded-lg border bg-card p-3 ${
        isDragging ? "z-50 shadow-lg" : "shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab p-1 text-muted-foreground active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 space-y-3">
          {/* Kind switch */}
          <div className="flex gap-1">
            {KIND_OPTIONS.map(({ kind, icon: Icon }) => (
              <button
                key={kind}
                type="button"
                onClick={() => onChange(changeKind(element, kind))}
                disabled={disabled}
                className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
                  element.kind === kind
                    ? "bg-blue-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                <Icon className="h-3 w-3" />
                {t(`pages.pim.dynamicBlocks.kind.${kind}`)}
              </button>
            ))}
          </div>

          {/* Kind-specific input */}
          {element.kind === "text" ? (
            <textarea
              value={(element as TextElement).text}
              onChange={(e) => onChange({ ...element, kind: "text", text: e.target.value } as TextElement)}
              placeholder={t("pages.pim.dynamicBlocks.textPlaceholder")}
              disabled={disabled}
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ) : (
            <>
              <MediaInput
                entityCode={entityCode}
                kind={element.kind}
                value={(element as MediaElement).media}
                onChange={(media) => onChange({ ...element, media } as MediaElement)}
                disabled={disabled}
              />
              <input
                type="text"
                value={(element as MediaElement).media?.alt ?? ""}
                onChange={(e) =>
                  onChange({
                    ...element,
                    media: { ...(element as MediaElement).media, alt: e.target.value },
                  } as MediaElement)
                }
                placeholder={t("pages.pim.dynamicBlocks.altPlaceholder")}
                disabled={disabled}
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </>
          )}

          {/* Description */}
          <input
            type="text"
            value={element.description ?? ""}
            onChange={(e) => onChange({ ...element, description: e.target.value || undefined })}
            placeholder={t("pages.pim.dynamicBlocks.descriptionPlaceholder")}
            disabled={disabled}
            className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          />

          {/* Link */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <ExternalLink className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={link?.href ?? ""}
                onChange={(e) => patchLink({ href: e.target.value })}
                onBlur={() => {
                  if (link?.href) patchLink({ href: normalizeUrl(link.href) });
                }}
                placeholder={t("pages.pim.dynamicBlocks.linkPlaceholder")}
                disabled={disabled}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={link?.new_tab ?? false}
                onChange={(e) => patchLink({ new_tab: e.target.checked })}
                disabled={disabled || !link?.href}
                className="h-3 w-3"
              />
              {t("pages.pim.dynamicBlocks.newTab")}
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(element.id)}
          disabled={disabled}
          className="mt-1 p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
          title={t("pages.pim.dynamicBlocks.deleteElement")}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
