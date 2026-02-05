"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";

interface MessageInputProps {
  onSend: (content: string) => void;
  isSending?: boolean;
  placeholder?: string;
  compact?: boolean;
}

export function MessageInput({
  onSend,
  isSending = false,
  placeholder = "Type a message...",
  compact = false,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, compact ? 80 : 150);
      textarea.style.height = `${newHeight}px`;
    }
  }, [content, compact]);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    onSend(trimmed);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className={`flex items-end gap-2 ${compact ? "" : ""}`}>
      <div className="flex-1 relative">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          className={`w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${
            compact ? "min-h-[36px]" : "min-h-[44px]"
          }`}
          disabled={isSending}
        />
      </div>
      <button
        onClick={handleSubmit}
        disabled={!content.trim() || isSending}
        className={`rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center ${
          compact ? "p-2" : "px-4 py-2"
        }`}
      >
        {isSending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
