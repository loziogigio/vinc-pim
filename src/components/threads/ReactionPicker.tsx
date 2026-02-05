"use client";

import { useEffect, useRef } from "react";
import { ThumbsUp, Heart, ThumbsDown } from "lucide-react";
import type { ReactionType } from "@/lib/types/thread";

interface ReactionPickerProps {
  onSelect: (type: ReactionType) => void;
  onClose: () => void;
}

export function ReactionPicker({ onSelect, onClose }: ReactionPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const reactions: { type: ReactionType; icon: React.ElementType; label: string; color: string }[] = [
    { type: "like", icon: ThumbsUp, label: "Like", color: "text-blue-500 hover:bg-blue-100" },
    { type: "love", icon: Heart, label: "Love", color: "text-red-500 hover:bg-red-100" },
    { type: "thumbsup", icon: ThumbsUp, label: "Thumbs Up", color: "text-emerald-500 hover:bg-emerald-100" },
    { type: "thumbsdown", icon: ThumbsDown, label: "Thumbs Down", color: "text-gray-500 hover:bg-gray-100" },
  ];

  return (
    <div
      ref={pickerRef}
      className="absolute bottom-full left-0 mb-2 bg-card border border-border rounded-lg shadow-lg p-1 flex items-center gap-1 z-10"
    >
      {reactions.map((reaction) => (
        <button
          key={reaction.type}
          onClick={() => onSelect(reaction.type)}
          className={`p-2 rounded-lg transition ${reaction.color}`}
          title={reaction.label}
        >
          <reaction.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
