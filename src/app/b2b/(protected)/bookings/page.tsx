import { CalendarCheck, Ship, Clock } from "lucide-react";

export default function BookingsOverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#5e5873]">Prenotazioni</h1>
        <p className="text-[#b9b9c3] mt-1">
          Gestione partenze, disponibilità e prenotazioni
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-teal-50">
              <Ship className="h-5 w-5 text-teal-600" />
            </div>
            <h3 className="font-semibold text-[#5e5873]">Partenze</h3>
          </div>
          <p className="text-sm text-[#b9b9c3]">
            Crea e gestisci partenze con risorse e capacità
          </p>
        </div>

        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <CalendarCheck className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-[#5e5873]">Prenotazioni</h3>
          </div>
          <p className="text-sm text-[#b9b9c3]">
            Visualizza e gestisci le prenotazioni dei clienti
          </p>
        </div>

        <div className="rounded-[0.428rem] border border-[#ebe9f1] bg-white p-6 shadow-[0_4px_24px_0_rgba(34,41,47,0.08)]">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-[#5e5873]">In Attesa</h3>
          </div>
          <p className="text-sm text-[#b9b9c3]">
            Prenotazioni in attesa di conferma con timer di scadenza
          </p>
        </div>
      </div>
    </div>
  );
}
