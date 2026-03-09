"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect } from "react";

import type { PersonRecord } from "@/models/Person";
import {
  formatDateLabel,
  getLifeSpanLabel,
  getPersonDisplayName,
  getPersonShortName,
} from "@/utils/familyTree";

interface PersonModalProps {
  person: PersonRecord | null;
  peopleById: Map<string, PersonRecord>;
  onClose: () => void;
  onEdit?: (personId: string) => void;
}

function renderPeopleList(ids: string[], peopleById: Map<string, PersonRecord>): string {
  if (ids.length === 0) {
    return "Nessuno";
  }

  return ids
    .map((id) => peopleById.get(id))
    .filter((person): person is PersonRecord => Boolean(person))
    .map((person) => getPersonShortName(person))
    .join(", ");
}

export function PersonModal({ person, peopleById, onClose, onEdit }: PersonModalProps) {
  useEffect(() => {
    if (!person) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, person]);

  if (!person) {
    return null;
  }

  const title = getPersonDisplayName(person);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#faf5eb] text-slate-900 shadow-[0_30px_120px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 border-b border-slate-900/10 bg-[linear-gradient(140deg,#153524_0%,#1f5135_52%,#d4b26f_100%)] px-6 py-6 text-white md:grid-cols-[220px_1fr]">
          <div className="flex min-h-56 items-end rounded-[24px] border border-white/20 bg-white/10 p-5">
            {person.photo ? (
              <img
                alt={title}
                className="h-full max-h-56 w-full rounded-[18px] object-cover"
                src={person.photo}
              />
            ) : (
              <div className="flex h-full min-h-44 w-full items-center justify-center rounded-[18px] border border-dashed border-white/35 bg-black/10 text-5xl font-semibold">
                {title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-white/70">Scheda persona</p>
                <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-white/80">{getLifeSpanLabel(person)}</p>
              </div>
              <div className="flex gap-2">
                {onEdit ? (
                  <button
                    className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12"
                    onClick={() => onEdit(person.id)}
                    type="button"
                  >
                    Modifica
                  </button>
                ) : null}
                <button
                  className="rounded-full border border-white/25 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12"
                  onClick={onClose}
                  type="button"
                >
                  Chiudi
                </button>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-white/90">
              {person.notes ??
                "Nessuna nota disponibile. Apri la modalita' amministratore per arricchire la scheda."}
            </p>
            <div className="flex flex-wrap gap-2">
              {(person.tags ?? []).map((tag) => (
                <span
                  className="rounded-full bg-white/12 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/90"
                  key={tag}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Anagrafica</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-700">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Nome noto</dt>
                <dd>{person.knownAs ?? "Non indicato"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Sesso</dt>
                <dd>{person.sex ?? "Non indicato"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Nascita</dt>
                <dd>
                  {formatDateLabel(person.birthDate)}
                  {person.birthPlace ? ` · ${person.birthPlace}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Decesso</dt>
                <dd>
                  {person.deathDate ? formatDateLabel(person.deathDate) : "Ancora in vita"}
                  {person.deathPlace ? ` · ${person.deathPlace}` : ""}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Professione</dt>
                <dd>{person.profession ?? "Non indicata"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">Istruzione</dt>
                <dd>{person.instruction ?? "Non indicata"}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Relazioni</p>
            <dl className="mt-4 space-y-3 text-sm text-slate-700">
              <div>
                <dt className="text-slate-500">Genitori</dt>
                <dd className="mt-1">{renderPeopleList(person.parentIds, peopleById)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Figli</dt>
                <dd className="mt-1">{renderPeopleList(person.childIds, peopleById)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Partner</dt>
                <dd className="mt-1">{renderPeopleList(person.partnerIds, peopleById)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm md:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Materiali e note</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Segni distintivi</h3>
                <p className="mt-1 text-sm text-slate-700">
                  {person.distinguishingMarks ?? "Nessun dettaglio annotato."}
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Allegati</h3>
                <p className="mt-1 text-sm text-slate-700">
                  {person.attachments?.join(", ") ?? "Nessun allegato."}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
