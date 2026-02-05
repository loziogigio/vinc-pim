"use client";

import { MessageSquare, X, Lock, Archive } from "lucide-react";

interface ThreadHeaderProps {
  subject?: string;
  status: "open" | "closed" | "archived";
  messageCount: number;
  onClose?: () => void;
}

export function ThreadHeader({
  subject,
  status,
  messageCount,
  onClose,
}: ThreadHeaderProps) {
  const statusStyles = {
    open: "bg-emerald-100 text-emerald-700",
    closed: "bg-gray-100 text-gray-700",
    archived: "bg-amber-100 text-amber-700",
  };

  const StatusIcon = status === "closed" ? Lock : status === "archived" ? Archive : null;

  return (
    <div className="p-4 border-b border-border flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">
            {subject || "Discussion"}
          </h3>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{messageCount} message{messageCount !== 1 ? "s" : ""}</span>
            {status !== "open" && (
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${statusStyles[status]}`}
              >
                {StatusIcon && <StatusIcon className="h-3 w-3" />}
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            )}
          </div>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-muted transition"
        >
          <X className="h-5 w-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
