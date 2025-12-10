"use client";

import "./editor.css";
import { useEditor, EditorContent } from "@tiptap/react";
import { useState, useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import { CustomImage } from "./ImageNode";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  ImageIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Heading1,
  Heading2,
  Heading3,
  Code,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder = "Start typing...",
  disabled = false,
  minHeight = "200px",
}: RichTextEditorProps) {
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [htmlContent, setHtmlContent] = useState(content);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline cursor-pointer",
        },
      }),
      CustomImage,
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setHtmlContent(html);
      onChange(html);
    },
  });

  if (!editor) {
    return null;
  }

  const toggleHtmlMode = () => {
    if (isHtmlMode) {
      // Switching from HTML to WYSIWYG
      editor.commands.setContent(htmlContent);
      onChange(htmlContent);
    } else {
      // Switching from WYSIWYG to HTML
      setHtmlContent(editor.getHTML());
    }
    setIsHtmlMode(!isHtmlMode);
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newHtml = e.target.value;
    setHtmlContent(newHtml);
    onChange(newHtml);
  };

  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      (editor.chain().focus() as any).setCustomImage({
        src: data.url,
        alt: "",
        title: "",
        width: "500px",
        align: "center"
      }).run();
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

  const triggerImageUpload = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`border border-border rounded-lg overflow-hidden ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        disabled={disabled || isUploading}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/30 border-b border-border">
        {/* HTML/WYSIWYG Toggle */}
        <button
          type="button"
          onClick={toggleHtmlMode}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            isHtmlMode ? "bg-muted text-primary" : ""
          }`}
          title={isHtmlMode ? "Switch to Visual Editor" : "Switch to HTML Editor"}
        >
          <Code className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Only show formatting tools in WYSIWYG mode */}
        {!isHtmlMode && (
          <>
        {/* Text Formatting */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("bold") ? "bg-muted text-primary" : ""
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("italic") ? "bg-muted text-primary" : ""
          }`}
          title="Italic (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Headings */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("heading", { level: 1 }) ? "bg-muted text-primary" : ""
          }`}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("heading", { level: 2 }) ? "bg-muted text-primary" : ""
          }`}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("heading", { level: 3 }) ? "bg-muted text-primary" : ""
          }`}
          title="Heading 3"
        >
          <Heading3 className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Lists */}
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("bulletList") ? "bg-muted text-primary" : ""
          }`}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("orderedList") ? "bg-muted text-primary" : ""
          }`}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("blockquote") ? "bg-muted text-primary" : ""
          }`}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Alignment */}
        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive({ textAlign: "left" }) ? "bg-muted text-primary" : ""
          }`}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive({ textAlign: "center" }) ? "bg-muted text-primary" : ""
          }`}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive({ textAlign: "right" }) ? "bg-muted text-primary" : ""
          }`}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Insert */}
        <button
          type="button"
          onClick={addLink}
          disabled={disabled}
          className={`p-2 rounded hover:bg-muted transition ${
            editor.isActive("link") ? "bg-muted text-primary" : ""
          }`}
          title="Add Link"
        >
          <LinkIcon className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={triggerImageUpload}
          disabled={disabled || isUploading}
          className="p-2 rounded hover:bg-muted transition disabled:opacity-50"
          title={isUploading ? "Uploading..." : "Upload Image"}
        >
          {isUploading ? (
            <Upload className="h-4 w-4 animate-pulse" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </button>

        <div className="w-px h-6 bg-border mx-1" />

        {/* Undo/Redo */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          className="p-2 rounded hover:bg-muted transition disabled:opacity-30"
          title="Undo (Ctrl+Z)"
        >
          <Undo className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          className="p-2 rounded hover:bg-muted transition disabled:opacity-30"
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo className="h-4 w-4" />
        </button>
          </>
        )}
      </div>

      {/* Editor Content */}
      {isHtmlMode ? (
        <textarea
          value={htmlContent}
          onChange={handleHtmlChange}
          disabled={disabled}
          className="w-full p-4 font-mono text-sm bg-background text-foreground focus:outline-none resize-none"
          style={{ minHeight }}
          placeholder="Enter HTML code..."
        />
      ) : (
        <EditorContent
          editor={editor}
          className="prose prose-sm max-w-none p-4 focus:outline-none"
          style={{ minHeight }}
        />
      )}
    </div>
  );
}
