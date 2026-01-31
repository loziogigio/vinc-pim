"use client";

import { useState } from "react";
import { Clock, Calendar, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CampaignScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (scheduledAt: Date) => Promise<void>;
  isScheduling?: boolean;
}

export function CampaignScheduleModal({
  isOpen,
  onClose,
  onSchedule,
  isScheduling = false,
}: CampaignScheduleModalProps) {
  // Default to tomorrow at 9:00 AM
  const getDefaultDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    return tomorrow;
  };

  const [selectedDate, setSelectedDate] = useState<Date>(getDefaultDate());

  // Format date for input (local time, not UTC)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Get minimum date (now + 5 minutes)
  const getMinDate = () => {
    const min = new Date();
    min.setMinutes(min.getMinutes() + 5);
    return formatDateForInput(min);
  };

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    return date.toLocaleString("it-IT", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setSelectedDate(newDate);
    }
  };

  const handleSchedule = async () => {
    await onSchedule(selectedDate);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Pianifica Campagna</h3>
              <p className="text-sm text-slate-500">Scegli quando inviare</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isScheduling}
            className="p-2 rounded-lg hover:bg-slate-100 transition disabled:opacity-50"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Date/Time Picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-1" />
              Data e Ora
            </label>
            <input
              type="datetime-local"
              value={formatDateForInput(selectedDate)}
              min={getMinDate()}
              onChange={handleDateChange}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Preview */}
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              La campagna verrà inviata:
            </p>
            <p className="text-sm font-medium text-blue-900 mt-1">
              {formatDateDisplay(selectedDate)}
            </p>
          </div>

          {/* Quick Options */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                const date = new Date();
                date.setHours(date.getHours() + 1, 0, 0, 0);
                setSelectedDate(date);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Tra 1 ora
            </button>
            <button
              type="button"
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + 1);
                date.setHours(9, 0, 0, 0);
                setSelectedDate(date);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Domani 9:00
            </button>
            <button
              type="button"
              onClick={() => {
                const date = new Date();
                date.setDate(date.getDate() + 7);
                date.setHours(9, 0, 0, 0);
                setSelectedDate(date);
              }}
              className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Tra 1 settimana
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-slate-200">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isScheduling}
          >
            Annulla
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={isScheduling}
            className="gap-2"
          >
            {isScheduling ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Pianificando...
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Pianifica
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
