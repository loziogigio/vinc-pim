"use client";

import { useState } from "react";
import {
  Pin,
  Reply,
  ThumbsUp,
  Heart,
  ThumbsDown,
  Clock,
  Eye,
  MoreHorizontal,
  Pencil,
} from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { MessageInput } from "./MessageInput";
import type { ThreadMessage, ReactionType } from "@/lib/types/thread";

interface MessageItemProps {
  message: ThreadMessage;
  replies?: ThreadMessage[];
  currentUserId: string;
  currentUserType: "customer" | "sales" | "admin";
  onReply: (content: string) => void;
  onReaction: (type: ReactionType) => void;
  onTogglePin?: () => void;
  showPinBadge?: boolean;
  depth?: number;
}

export function MessageItem({
  message,
  replies = [],
  currentUserId,
  currentUserType,
  onReply,
  onReaction,
  onTogglePin,
  showPinBadge = false,
  depth = 0,
}: MessageItemProps) {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Format time ago
  const formatTimeAgo = (date: Date | string) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Author type badge colors
  const authorTypeBadge = {
    customer: "bg-blue-100 text-blue-700",
    sales: "bg-emerald-100 text-emerald-700",
    admin: "bg-purple-100 text-purple-700",
    system: "bg-gray-100 text-gray-600",
  };

  // Reaction icons
  const reactionIcons: Record<string, React.ElementType> = {
    like: ThumbsUp,
    love: Heart,
    thumbsup: ThumbsUp,
    thumbsdown: ThumbsDown,
  };

  // Group reactions by type
  const groupedReactions = message.reactions.reduce(
    (acc, r) => {
      acc[r.reaction_type] = (acc[r.reaction_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Check if current user has reacted
  const userReaction = message.reactions.find((r) => r.user_id === currentUserId);

  // Can pin: only sales/admin
  const canPin = currentUserType === "sales" || currentUserType === "admin";

  // Indent style for nested replies
  const indentClass = depth === 0 ? "" : depth === 1 ? "ml-8" : "ml-12";

  return (
    <div className={`group ${indentClass}`}>
      {/* Main message */}
      <div
        className={`rounded-lg p-3 ${
          message.is_internal
            ? "bg-amber-50 border border-amber-200"
            : "bg-muted/50"
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Avatar placeholder */}
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-sm">
              {message.author_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-foreground">
                  {message.author_name}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    authorTypeBadge[message.author_type]
                  }`}
                >
                  {message.author_type}
                </span>
                {showPinBadge && message.is_pinned && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 flex items-center gap-0.5">
                    <Pin className="h-2.5 w-2.5" />
                    Pinned
                  </span>
                )}
                {message.is_internal && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-amber-100 text-amber-700 flex items-center gap-0.5">
                    <Eye className="h-2.5 w-2.5" />
                    Internal
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatTimeAgo(message.created_at)}
                {message.edited_at && (
                  <span className="flex items-center gap-0.5">
                    <Pencil className="h-2.5 w-2.5" />
                    edited
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Actions menu */}
          <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
            {canPin && onTogglePin && (
              <button
                onClick={onTogglePin}
                className={`p-1.5 rounded hover:bg-background transition ${
                  message.is_pinned ? "text-amber-600" : "text-muted-foreground"
                }`}
                title={message.is_pinned ? "Unpin" : "Pin"}
              >
                <Pin className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="text-sm text-foreground whitespace-pre-wrap">
          {message.content}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((att) => (
              <a
                key={att.attachment_id}
                href={att.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 rounded bg-background border border-border hover:bg-muted transition"
              >
                {att.filename}
              </a>
            ))}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(groupedReactions).length > 0 && (
          <div className="mt-2 flex items-center gap-1">
            {Object.entries(groupedReactions).map(([type, count]) => {
              const Icon = reactionIcons[type] || ThumbsUp;
              const isActive = userReaction?.reaction_type === type;
              return (
                <button
                  key={type}
                  onClick={() => onReaction(type as ReactionType)}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition ${
                    isActive
                      ? "bg-primary/20 text-primary"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {count}
                </button>
              );
            })}
          </div>
        )}

        {/* Action bar */}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          {/* Reaction button */}
          <div className="relative">
            <button
              onClick={() => setShowReactionPicker(!showReactionPicker)}
              className="hover:text-foreground transition flex items-center gap-1"
            >
              <ThumbsUp className="h-3.5 w-3.5" />
              React
            </button>
            {showReactionPicker && (
              <ReactionPicker
                onSelect={(type) => {
                  onReaction(type);
                  setShowReactionPicker(false);
                }}
                onClose={() => setShowReactionPicker(false)}
              />
            )}
          </div>

          {/* Reply button - only show if not at max depth */}
          {depth < 2 && (
            <button
              onClick={() => setShowReplyInput(!showReplyInput)}
              className="hover:text-foreground transition flex items-center gap-1"
            >
              <Reply className="h-3.5 w-3.5" />
              Reply
              {message.replies_count > 0 && ` (${message.replies_count})`}
            </button>
          )}
        </div>

        {/* Reply input */}
        {showReplyInput && (
          <div className="mt-3 pt-3 border-t border-border">
            <MessageInput
              onSend={(content) => {
                onReply(content);
                setShowReplyInput(false);
              }}
              placeholder="Write a reply..."
              compact
            />
          </div>
        )}
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {replies
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
            .map((reply) => (
              <MessageItem
                key={reply.message_id}
                message={reply}
                currentUserId={currentUserId}
                currentUserType={currentUserType}
                onReply={onReply}
                onReaction={(type) => {
                  // Handle reaction on reply - parent component should handle
                }}
                depth={depth + 1}
              />
            ))}
        </div>
      )}
    </div>
  );
}
