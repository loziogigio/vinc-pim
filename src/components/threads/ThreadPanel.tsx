"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Loader2, X, MessageCircle } from "lucide-react";
import { ThreadHeader } from "./ThreadHeader";
import { MessageItem } from "./MessageItem";
import { MessageInput } from "./MessageInput";
import type { Thread, ThreadMessage } from "@/lib/types/thread";

interface ThreadPanelProps {
  refType: string;
  refId: string;
  mode?: "panel" | "modal" | "sidebar";
  onClose?: () => void;
  className?: string;
  currentUserId?: string;
  currentUserName?: string;
  currentUserType?: "customer" | "sales" | "admin";
}

export function ThreadPanel({
  refType,
  refId,
  mode = "panel",
  onClose,
  className = "",
  currentUserId = "anonymous",
  currentUserName = "User",
  currentUserType = "customer",
}: ThreadPanelProps) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch or create thread
  const fetchThread = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the ref-specific endpoint
      const res = await fetch(`/api/b2b/${refType}s/${refId}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setThread(data.thread);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to load thread");
      }
    } catch (err) {
      console.error("Error fetching thread:", err);
      setError("Failed to load thread");
    } finally {
      setIsLoading(false);
    }
  }, [refType, refId]);

  useEffect(() => {
    fetchThread();
  }, [fetchThread]);

  // Mark as read when thread is viewed
  useEffect(() => {
    if (thread?.thread_id && currentUserId !== "anonymous") {
      fetch(`/api/b2b/threads/${thread.thread_id}/read`, {
        method: "POST",
      }).catch(console.error);
    }
  }, [thread?.thread_id, currentUserId]);

  // Send message
  const handleSendMessage = async (content: string, parentId?: string) => {
    if (!thread) return;

    setIsSending(true);
    try {
      const res = await fetch(`/api/b2b/threads/${thread.thread_id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          parent_id: parentId,
          author_name: currentUserName,
          author_type: currentUserType,
        }),
      });

      if (res.ok) {
        // Refetch thread to get updated messages
        await fetchThread();
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to send message");
      }
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  // Handle reaction
  const handleReaction = async (
    messageId: string,
    reactionType: "like" | "love" | "thumbsup" | "thumbsdown"
  ) => {
    if (!thread) return;

    try {
      const res = await fetch(
        `/api/b2b/threads/${thread.thread_id}/messages/${messageId}/react`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            reaction_type: reactionType,
            user_name: currentUserName,
          }),
        }
      );

      if (res.ok) {
        await fetchThread();
      }
    } catch (err) {
      console.error("Error adding reaction:", err);
    }
  };

  // Handle pin toggle
  const handleTogglePin = async (messageId: string, pinned: boolean) => {
    if (!thread) return;

    try {
      const res = await fetch(
        `/api/b2b/threads/${thread.thread_id}/messages/${messageId}/pin`,
        {
          method: pinned ? "POST" : "DELETE",
        }
      );

      if (res.ok) {
        await fetchThread();
      }
    } catch (err) {
      console.error("Error toggling pin:", err);
    }
  };

  // Organize messages: pinned first, then top-level with replies nested
  const organizeMessages = (messages: ThreadMessage[]) => {
    const pinnedMessages = messages.filter((m) => m.is_pinned && !m.is_deleted);
    const topLevelMessages = messages.filter(
      (m) => !m.parent_id && !m.is_deleted && !m.is_pinned
    );

    // Create a map for quick lookup of replies
    const repliesMap = new Map<string, ThreadMessage[]>();
    messages.forEach((m) => {
      if (m.parent_id && !m.is_deleted) {
        const existing = repliesMap.get(m.parent_id) || [];
        existing.push(m);
        repliesMap.set(m.parent_id, existing);
      }
    });

    return { pinnedMessages, topLevelMessages, repliesMap };
  };

  // Filter internal messages for customers
  const filterMessages = (messages: ThreadMessage[]) => {
    if (currentUserType === "customer") {
      return messages.filter((m) => !m.is_internal);
    }
    return messages;
  };

  // Container styles based on mode
  const containerStyles = {
    panel: "rounded-lg bg-card border border-border shadow-sm",
    modal:
      "fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4",
    sidebar: "h-full flex flex-col bg-card border-l border-border",
  };

  const innerStyles = {
    panel: "",
    modal: "bg-card rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col",
    sidebar: "flex-1 flex flex-col",
  };

  if (isLoading) {
    return (
      <div className={`${containerStyles[mode]} ${className}`}>
        <div className={innerStyles[mode]}>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${containerStyles[mode]} ${className}`}>
        <div className={innerStyles[mode]}>
          <div className="p-4 text-center">
            <p className="text-red-600 text-sm">{error}</p>
            <button
              onClick={fetchThread}
              className="mt-2 text-sm text-primary hover:underline"
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const filteredMessages = thread ? filterMessages(thread.messages) : [];
  const { pinnedMessages, topLevelMessages, repliesMap } =
    organizeMessages(filteredMessages);

  return (
    <div className={`${containerStyles[mode]} ${className}`}>
      <div className={innerStyles[mode]}>
        {/* Header */}
        <ThreadHeader
          subject={thread?.subject}
          status={thread?.status || "open"}
          messageCount={thread?.message_count || 0}
          onClose={mode !== "panel" ? onClose : undefined}
        />

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {filteredMessages.length === 0 ? (
            <div className="text-center py-8">
              <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                No messages yet. Start the conversation!
              </p>
            </div>
          ) : (
            <>
              {/* Pinned Messages */}
              {pinnedMessages.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Pinned
                  </p>
                  {pinnedMessages.map((message) => (
                    <MessageItem
                      key={message.message_id}
                      message={message}
                      replies={repliesMap.get(message.message_id) || []}
                      currentUserId={currentUserId}
                      currentUserType={currentUserType}
                      onReply={(content) =>
                        handleSendMessage(content, message.message_id)
                      }
                      onReaction={(type) =>
                        handleReaction(message.message_id, type)
                      }
                      onTogglePin={() =>
                        handleTogglePin(message.message_id, false)
                      }
                      showPinBadge
                    />
                  ))}
                </div>
              )}

              {/* Regular Messages */}
              {topLevelMessages.map((message) => (
                <MessageItem
                  key={message.message_id}
                  message={message}
                  replies={repliesMap.get(message.message_id) || []}
                  currentUserId={currentUserId}
                  currentUserType={currentUserType}
                  onReply={(content) =>
                    handleSendMessage(content, message.message_id)
                  }
                  onReaction={(type) =>
                    handleReaction(message.message_id, type)
                  }
                  onTogglePin={() =>
                    handleTogglePin(message.message_id, !message.is_pinned)
                  }
                />
              ))}
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-border p-4">
          <MessageInput
            onSend={(content) => handleSendMessage(content)}
            isSending={isSending}
            placeholder="Type a message..."
          />
        </div>
      </div>
    </div>
  );
}
