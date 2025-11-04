"use client";

import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from "@tiptap/react";
import { useState, useRef, useEffect } from "react";
import { AlignLeft, AlignCenter, AlignRight, Trash2 } from "lucide-react";

// Declare module augmentation for TypeScript
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    customImage: {
      setCustomImage: (options: { src: string; alt?: string; title?: string }) => ReturnType;
    };
  }
}

// React component for the image node view
function ImageNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const [showControls, setShowControls] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setShowControls(selected);
  }, [selected]);

  const setSize = (size: "small" | "medium" | "large" | "original") => {
    const sizes = {
      small: "300px",
      medium: "500px",
      large: "700px",
      original: "100%"
    };
    updateAttributes({ width: sizes[size] });
  };

  const setAlignment = (align: "left" | "center" | "right") => {
    updateAttributes({ align });
  };

  const alignmentMap: Record<string, string> = {
    left: "mr-auto",
    center: "mx-auto",
    right: "ml-auto"
  };
  const alignmentClass = alignmentMap[node.attrs.align || "center"];

  return (
    <NodeViewWrapper className="relative my-4">
      <div className="flex flex-col gap-2">
        {/* Image */}
        <div className={`relative inline-block ${alignmentClass}`}>
          <img
            ref={imageRef}
            src={node.attrs.src}
            alt={node.attrs.alt || ""}
            title={node.attrs.title || ""}
            className="rounded-lg transition-all hover:ring-4 hover:ring-blue-400 hover:ring-offset-2"
            style={{
              width: node.attrs.width || "auto",
              maxWidth: "100%",
              height: "auto",
              cursor: "pointer"
            }}
            onClick={() => setShowControls(!showControls)}
          />

          {/* Controls overlay when selected */}
          {showControls && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white border border-border rounded-lg shadow-lg p-1 flex items-center gap-1 z-10">
              {/* Size buttons */}
              <button
                onClick={() => setSize("small")}
                className="px-3 py-1 text-xs font-medium rounded hover:bg-muted transition"
                title="Small (300px)"
              >
                Small
              </button>
              <button
                onClick={() => setSize("medium")}
                className="px-3 py-1 text-xs font-medium rounded hover:bg-muted transition"
                title="Medium (500px)"
              >
                Medium
              </button>
              <button
                onClick={() => setSize("large")}
                className="px-3 py-1 text-xs font-medium rounded hover:bg-muted transition"
                title="Large (700px)"
              >
                Large
              </button>
              <button
                onClick={() => setSize("original")}
                className="px-3 py-1 text-xs font-medium rounded hover:bg-muted transition"
                title="Original size"
              >
                Original
              </button>

              <div className="w-px h-6 bg-border mx-1" />

              {/* Alignment buttons */}
              <button
                onClick={() => setAlignment("left")}
                className={`p-1.5 rounded hover:bg-muted transition ${
                  node.attrs.align === "left" ? "bg-muted" : ""
                }`}
                title="Align left"
              >
                <AlignLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAlignment("center")}
                className={`p-1.5 rounded hover:bg-muted transition ${
                  node.attrs.align === "center" || !node.attrs.align ? "bg-muted" : ""
                }`}
                title="Align center"
              >
                <AlignCenter className="h-4 w-4" />
              </button>
              <button
                onClick={() => setAlignment("right")}
                className={`p-1.5 rounded hover:bg-muted transition ${
                  node.attrs.align === "right" ? "bg-muted" : ""
                }`}
                title="Align right"
              >
                <AlignRight className="h-4 w-4" />
              </button>

              <div className="w-px h-6 bg-border mx-1" />

              {/* Delete button */}
              <button
                onClick={deleteNode}
                className="p-1.5 rounded hover:bg-red-100 text-red-600 transition"
                title="Delete image"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Size indicator when selected */}
        {showControls && (
          <div className="text-xs text-muted-foreground text-center">
            Current width: {node.attrs.width || "auto"}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// Custom Tiptap Image extension
export const CustomImage = Node.create({
  name: "customImage",

  group: "block",

  atom: true,

  addAttributes() {
    return {
      src: {
        default: null
      },
      alt: {
        default: null
      },
      title: {
        default: null
      },
      width: {
        default: "500px"
      },
      align: {
        default: "center"
      }
    };
  },

  parseHTML() {
    return [
      {
        tag: "img[src]"
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ["img", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      setCustomImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options
          });
        }
    };
  }
});
