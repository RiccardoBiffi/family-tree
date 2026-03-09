"use client";

import Link from "next/link";
import { useId } from "react";

interface ArchiveActionsProps {
  mode: "visitor" | "admin";
  query: string;
  onCreatePerson: () => void;
  onQueryChange: (value: string) => void;
  onResetDemoData: () => void;
}

const buttonClassName =
  "rounded-full border border-[#d9cfbd] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]";

export function ArchiveActions({
  mode,
  query,
  onCreatePerson,
  onQueryChange,
  onResetDemoData,
}: ArchiveActionsProps) {
  const isAdmin = mode === "admin";
  const searchInputId = useId();

  return (
    <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Azioni</p>
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-900">
            {isAdmin ? "Aggiorna l'archivio locale" : "Consulta e ricerca l'archivio"}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {isAdmin
              ? "Per modificare una persona, apri la sua scheda da diagramma, tabella o timeline e usa Modifica. La creazione avviene da modale e ogni cambiamento resta salvato solo nel browser corrente."
              : "La vista pubblica e' di sola consultazione. Per creare o modificare persone e relazioni apri l'URL /admin dallo stesso browser e usa il pulsante Modifica dentro il profilo della persona."}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {isAdmin ? (
              <>
                <button className={buttonClassName} onClick={onCreatePerson} type="button">
                  Nuova persona
                </button>
                <button className={buttonClassName} onClick={onResetDemoData} type="button">
                  Ripristina demo
                </button>
                <Link className={buttonClassName} href="/">
                  Vai alla vista visitatore
                </Link>
              </>
            ) : (
              <Link className={buttonClassName} href="/admin">
                Apri amministrazione
              </Link>
            )}
          </div>
        </div>

        <label className="space-y-2" htmlFor={searchInputId}>
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Ricerca trasversale
          </span>
          <input
            aria-label="Ricerca trasversale"
            className="w-full rounded-[24px] border border-[#d9cfbd] bg-[#fffaf1] px-4 py-3 text-sm outline-none transition focus:border-[#5f8f63] focus:ring-4 focus:ring-[#5f8f63]/10"
            id={searchInputId}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Cerca per nome, tag, luogo o professione"
            value={query}
          />
          <p className="text-sm leading-6 text-slate-500">
            Nella timeline e nel diagramma la ricerca evidenzia le persone corrispondenti; in tabella riduce direttamente l&apos;elenco.
          </p>
        </label>
      </div>
    </section>
  );
}
