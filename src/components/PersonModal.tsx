"use client";
/* eslint-disable @next/next/no-img-element */

import { useId } from "react";

import { PersonMediaGallery } from "@/components/PersonMediaGallery";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { MediaAssetView } from "@/hooks/useMediaLibrary";
import { PERSON_SEX_LABELS, type PersonRecord } from "@/models/Person";
import {
  formatDateLabel,
  getBiologicalParentIds,
  getDiagramParentIds,
  getLifeSpanLabel,
  getPersonDisplayName,
  getPersonShortName,
} from "@/utils/familyTree";

interface PersonModalProps {
  person: PersonRecord | null;
  peopleById: Map<string, PersonRecord>;
  media?: readonly MediaAssetView[];
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

export function PersonModal({
  person,
  peopleById,
  media = [],
  onClose,
  onEdit,
}: PersonModalProps) {
  const titleId = useId();
  const dialogRef = useDialogFocus<HTMLDivElement>(Boolean(person), onClose);

  if (!person) {
    return null;
  }

  const title = getPersonDisplayName(person);
  const biologicalIds = getBiologicalParentIds(person);
  const adoptiveIds = person.parentIds.filter((id) => !biologicalIds.includes(id));
  const diagramIds = getDiagramParentIds(person);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#06150d]/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="flex max-h-[min(92dvh,calc(100dvh-32px))] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-[#dfe5df] bg-white text-[#152219] shadow-[0_30px_100px_rgba(6,21,13,0.28)] outline-none sm:max-h-[min(92dvh,calc(100dvh-64px))]"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-[#dfe5df] bg-[#f4f7f3] p-3 sm:gap-5 sm:px-6 sm:py-4">
          <div className="size-[clamp(3.25rem,16dvh,5rem)] overflow-hidden rounded-xl border border-[#cbd5cb] bg-[#edf2e9] sm:size-[clamp(4rem,18dvh,7rem)]">
            {person.photo ? (
              <img
                alt={title}
                className="size-full object-cover"
                src={person.photo}
              />
            ) : (
              <div aria-hidden="true" className="grid size-full place-items-center font-[family-name:var(--font-display)] text-2xl text-[#0c3b24] sm:text-4xl">
                {title.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#65746a]">
                  Scheda persona
                </p>
                <h2
                  className="mt-1 line-clamp-2 font-[family-name:var(--font-display)] text-2xl leading-tight text-[#17351f] [overflow-wrap:anywhere] sm:text-4xl"
                  id={titleId}
                >
                  {title}
                </h2>
                <p className="mt-1 text-sm text-[#526158]">{getLifeSpanLabel(person)}</p>
              </div>
              {onEdit ? (
                <button
                  className="min-h-11 rounded-xl border border-[#b9c5b8] bg-white px-4 text-sm font-medium text-[#17351f] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                  onClick={() => onEdit(person.id)}
                  type="button"
                >
                  Modifica
                </button>
              ) : null}
            </div>
          </div>
        </header>

        <div
          aria-label="Dettagli della persona"
          className="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#17452d] sm:px-6 sm:py-6"
          role="region"
          tabIndex={0}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Anagrafica</p>
              <dl className="mt-4 space-y-3 text-sm text-slate-700">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Nome noto</dt>
                  <dd>{person.knownAs ?? "Non indicato"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-500">Sesso</dt>
                  <dd>{person.sex ? PERSON_SEX_LABELS[person.sex] : "Non indicato"}</dd>
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

            <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Relazioni</p>
              {person.parentIds.length > 2 && person.biologicalParentIds === undefined ? (
                <p className="mt-3 text-sm text-[#526158]">Tipi di genitore proposti in base all’ordine del vecchio archivio.</p>
              ) : null}
              <dl className="mt-4 space-y-3 text-sm text-slate-700">
                <div>
                  <dt className="text-slate-500">Genitori biologici</dt>
                  <dd className="mt-1">{renderPeopleList(biologicalIds, peopleById)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Genitori adottivi</dt>
                  <dd className="mt-1">{renderPeopleList(adoptiveIds, peopleById)}</dd>
                </div>
                {person.parentIds.length > 2 ? (
                  <div>
                    <dt className="text-slate-500">Genitori nel diagramma</dt>
                    <dd className="mt-1">
                      {diagramIds.length === 2
                        ? renderPeopleList(diagramIds, peopleById)
                        : "Da selezionare"}
                    </dd>
                  </div>
                ) : null}
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

            <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5 md:col-span-2">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Materiali e note</p>
              <div className="mt-4">
                <p className="mb-3 text-sm leading-6 text-[#34443a] [overflow-wrap:anywhere] whitespace-pre-wrap">
                  {person.notes ?? "Nessuna nota disponibile."}
                </p>
                {person.tags?.length ? (
                  <ul aria-label="Etichette" className="mb-4 flex flex-wrap gap-2">
                    {person.tags.map((tag) => (
                      <li
                        className="max-w-full rounded-full border border-[#d5ddd5] bg-white px-3 py-1 text-xs font-medium text-[#526158] [overflow-wrap:anywhere]"
                        key={tag}
                      >
                        {tag}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">Segni distintivi</h3>
                  <p className="mt-1 text-sm text-slate-700">
                    {person.distinguishingMarks ?? "Nessun dettaglio annotato."}
                  </p>
                </div>
              </div>
              {media.length > 0 ? (
                <h3 className="mt-5 text-sm font-semibold text-slate-900">Contenuti multimediali</h3>
              ) : null}
              <PersonMediaGallery media={media} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
