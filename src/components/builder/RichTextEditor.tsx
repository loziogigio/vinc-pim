"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import { useEffect, useRef, useState } from "react";
import { CustomImage } from "./ImageNode";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link2,
  Heading2,
  Quote,
  Code,
  Undo,
  Redo,
  ImageIcon,
  ChevronDown,
  Palette,
  Highlighter
} from "lucide-react";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Start typing..." }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showHighlight, setShowHighlight] = useState(false);

  const editor = useEditor({
    immediatelyRender: false, // Fix SSR hydration mismatch
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Placeholder.configure({
        placeholder
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline"
        }
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true
      }),
      CustomImage
    ],
    content,
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-[200px] px-4 py-3"
      }
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    }
  });

  // Update editor content when prop changes (but not if it came from the editor itself)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setShowTextColor(false);
      setShowHighlight(false);
    };

    if (showTextColor || showHighlight) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [showTextColor, showHighlight]);

  if (!editor) {
    return null;
  }

  const setLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB");
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (base64) {
        // Insert image with custom node
        (editor.chain().focus() as any).setCustomImage({
          src: base64,
          alt: file.name.replace(/\.[^/.]+$/, ""), // filename without extension
          title: file.name,
          width: "500px",
          align: "center"
        }).run();
      }
    };
    reader.readAsDataURL(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  const MenuButton = ({
    onClick,
    active,
    disabled,
    children,
    title
  }: {
    onClick: (e?: React.MouseEvent<HTMLButtonElement>) => void;
    active?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-slate-100 transition-colors ${
        active ? "bg-slate-200 text-slate-900" : "text-slate-600"
      } ${disabled ? "opacity-30 cursor-not-allowed" : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div className="border border-slate-300 rounded-lg overflow-hidden bg-white">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-1 p-2 border-b border-slate-200 bg-slate-50">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* Text Color */}
        <div className="relative">
          <MenuButton
            onClick={(e) => {
              e?.stopPropagation();
              setShowTextColor(!showTextColor);
              setShowHighlight(false);
            }}
            title="Text Color"
          >
            <Palette className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </MenuButton>
          {showTextColor && (
            <div
              className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-400 rounded-lg shadow-2xl p-3 z-50 w-48"
              onClick={(e) => e?.stopPropagation()}
            >
              <div className="text-xs font-semibold text-slate-700 mb-2">Text Color</div>
              <div className="grid grid-cols-5 gap-2">
                {["#000000", "#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#64748b", "#ffffff"].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setColor(color).run();
                      setShowTextColor(false);
                    }}
                    className="w-8 h-8 rounded border-2 border-slate-400 hover:scale-125 hover:border-blue-500 transition shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                onChange={(e) => {
                  editor.chain().focus().setColor(e.target.value).run();
                }}
                className="w-full mt-2 h-8 rounded border border-slate-300 cursor-pointer"
                title="Custom color"
              />
              <button
                onClick={() => {
                  editor.chain().focus().setColor("#000000").run();
                  setShowTextColor(false);
                }}
                className="w-full mt-2 text-xs px-2 py-1.5 border border-slate-300 rounded hover:bg-slate-100 font-medium"
              >
                Reset to Black
              </button>
            </div>
          )}
        </div>

        {/* Highlight Color */}
        <div className="relative">
          <MenuButton
            onClick={(e) => {
              e?.stopPropagation();
              setShowHighlight(!showHighlight);
              setShowTextColor(false);
            }}
            title="Highlight"
          >
            <Highlighter className="h-4 w-4" />
            <ChevronDown className="h-3 w-3" />
          </MenuButton>
          {showHighlight && (
            <div
              className="absolute top-full left-0 mt-1 bg-white border-2 border-slate-400 rounded-lg shadow-2xl p-3 z-50 w-48"
              onClick={(e) => e?.stopPropagation()}
            >
              <div className="text-xs font-semibold text-slate-700 mb-2">Highlight Color</div>
              <div className="grid grid-cols-5 gap-2">
                {["#fef3c7", "#fecaca", "#fed7aa", "#d9f99d", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e2e8f0", "#fbbf24", "#ffffff"].map((color) => (
                  <button
                    key={color}
                    onClick={() => {
                      editor.chain().focus().setHighlight({ color }).run();
                      setShowHighlight(false);
                    }}
                    className="w-8 h-8 rounded border-2 border-slate-400 hover:scale-125 hover:border-blue-500 transition shadow-sm"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <input
                type="color"
                onChange={(e) => {
                  editor.chain().focus().setHighlight({ color: e.target.value }).run();
                }}
                className="w-full mt-2 h-8 rounded border border-slate-300 cursor-pointer"
                title="Custom highlight color"
              />
              <button
                onClick={() => {
                  editor.chain().focus().unsetHighlight().run();
                  setShowHighlight(false);
                }}
                className="w-full mt-2 text-xs px-2 py-1.5 border border-slate-300 rounded hover:bg-slate-100 font-medium"
              >
                Remove Highlight
              </button>
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive("heading", { level: 2 })}
          title="Heading"
        >
          <Heading2 className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive("blockquote")}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive("codeBlock")}
          title="Code Block"
        >
          <Code className="h-4 w-4" />
        </MenuButton>

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton onClick={setLink} active={editor.isActive("link")} title="Add Link">
          <Link2 className="h-4 w-4" />
        </MenuButton>

        <MenuButton onClick={triggerImageUpload} title="Upload Image">
          <ImageIcon className="h-4 w-4" />
        </MenuButton>

        <div className="flex-1" />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo className="h-4 w-4" />
        </MenuButton>

        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo className="h-4 w-4" />
        </MenuButton>
      </div>

      {/* Editor */}
      <EditorContent editor={editor} />

      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}
