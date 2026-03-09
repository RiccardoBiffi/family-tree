"use client";

import type { PersonRecord } from "@/models/Person";
import { getPersonDisplayName } from "@/utils/familyTree";

interface AdminPanelProps {
  people: PersonRecord[];
  selectedPersonId: string | null;
  onCreatePerson: () => void;
  onOpenPerson: (personId: string) => void;
  onResetDemoData: () => void;
}

export function AdminPanel({
  people,
  selectedPersonId,
  onCreatePerson,
  onOpenPerson,
  onResetDemoData,
}: AdminPanelProps) {
  return (
    <aside className="space-y-5">
      <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Modalita&apos; amministratore</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
              Crea e aggiorna dall&apos;archivio
            </h2>
          </div>
          <button
            className="rounded-full border border-[#d9cfbd] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]"
            onClick={onCreatePerson}
            type="button"
          >
            Nuova persona
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          La creazione avviene in modale. Per modificare una scheda esistente, apri la persona e usa il pulsante Modifica.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-full border border-[#d9cfbd] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]"
            onClick={onResetDemoData}
            type="button"
          >
            Ripristina demo
          </button>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Persone</p>
            <h3 className="text-lg font-semibold text-slate-900">Apri una scheda</h3>
          </div>
          <span className="rounded-full bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-slate-500">
            {people.length}
          </span>
        </div>
        <div className="mt-4 grid gap-2">
          {people.map((person) => (
            <button
              className={[
                "rounded-[22px] border px-4 py-3 text-left transition",
                person.id === selectedPersonId
                  ? "border-[#5f8f63] bg-white text-[#153524]"
                  : "border-[#d9cfbd] bg-white/60 text-slate-700 hover:border-[#5f8f63]",
              ].join(" ")}
              key={person.id}
              onClick={() => onOpenPerson(person.id)}
              type="button"
            >
              <span className="block font-medium">{getPersonDisplayName(person)}</span>
              <span className="mt-1 block text-xs uppercase tracking-[0.18em] text-slate-500">
                {person.birthDate ?? "data sconosciuta"}
              </span>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
