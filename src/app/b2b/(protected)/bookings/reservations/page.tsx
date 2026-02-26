import { CalendarCheck } from "lucide-react";

export default function ReservationsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#5e5873] flex items-center gap-2">
            <CalendarCheck className="h-6 w-6" />
            Prenotazioni
          </h1>
          <p className="text-[#b9b9c3] mt-1">
            Visualizza e gestisci le prenotazioni dei clienti
          </p>
        </div>
      </div>

      <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
        <p className="text-[#b9b9c3] text-center py-8">
          La lista delle prenotazioni sarà disponibile qui.
        </p>
      </div>
    </div>
  );
}
