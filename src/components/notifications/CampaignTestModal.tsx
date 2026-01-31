"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHANNEL_UI_CONFIG, type NotificationChannel } from "@/lib/constants/notification";

interface CampaignTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (testEmail: string) => Promise<void>;
  enabledChannels: Set<NotificationChannel>;
  isSending: boolean;
}

export function CampaignTestModal({
  isOpen,
  onClose,
  onSend,
  enabledChannels,
  isSending,
}: CampaignTestModalProps) {
  const [testEmail, setTestEmail] = useState("");

  if (!isOpen) return null;

  const handleSend = async () => {
    if (!testEmail) return;
    await onSend(testEmail);
    setTestEmail("");
  };

  const channelLabels = Array.from(enabledChannels)
    .map((c) => CHANNEL_UI_CONFIG[c]?.label)
    .filter(Boolean)
    .join(", ");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md m-4 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Invia Test</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Indirizzo Email di Test
          </label>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="test@esempio.com"
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Canali selezionati: {channelLabels}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={handleSend} disabled={!testEmail || isSending}>
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Invia Test
          </Button>
        </div>
      </div>
    </div>
  );
}
