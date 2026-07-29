"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import type { PersonRecord, PersonSex } from "@/models/Person";
import { getPersonDisplayName, getPersonShortName } from "@/utils/familyTree";

interface PersonEditorModalProps {
  mode: "create" | "edit";
  people: PersonRecord[];
  person: PersonRecord;
  onClose: () => void;
  onDelete?: (personId: string) => void;
  onSave: (draft: PersonRecord) => void;
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-[#cbd5cb] bg-white px-4 py-3 text-sm text-[#152219] outline-none transition focus:border-[#78907c] focus:ring-4 focus:ring-[#0c3b24]/10";

function toggleId(ids: string[], id: string, nextChecked: boolean): string[] {
  if (nextChecked) {
    return ids.includes(id) ? ids : [...ids, id];
  }

  return ids.filter((currentId) => currentId !== id);
}

function normalizeCommaSeparated(value: string): string[] | null {
  const normalized = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : null;
}

function RelationDropdown({
  label,
  people,
  selectedIds,
  onChange,
}: {
  label: string;
  people: PersonRecord[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
}) {
  const labelId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape, true);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen]);

  const filteredPeople = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return people;
    }

    return people.filter((person) =>
      getPersonDisplayName(person).toLowerCase().includes(normalizedSearch),
    );
  }, [people, search]);
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );

  const selectedPeopleLabel = useMemo(() => {
    if (selectedIds.length === 0) {
      return "Nessuna selezione";
    }

    return selectedIds
      .map((id) => peopleById.get(id))
      .filter((person): person is PersonRecord => Boolean(person))
      .map((person) => getPersonShortName(person))
      .join(", ");
  }, [peopleById, selectedIds]);

  return (
    <div className="space-y-2" ref={containerRef}>
      <span className="text-xs uppercase tracking-[0.18em] text-slate-500" id={labelId}>
        {label}
      </span>
      <div className="relative">
        <button
          aria-expanded={isOpen}
          aria-labelledby={labelId}
          className={`${fieldClassName} flex items-center justify-between text-left`}
          onClick={() => setIsOpen((currentValue) => !currentValue)}
          type="button"
        >
          <span className="truncate">{selectedPeopleLabel}</span>
          <span className="ml-4 text-xs uppercase tracking-[0.18em] text-slate-500">
            {selectedIds.length}
          </span>
        </button>

        {isOpen ? (
          <div className="absolute z-20 mt-2 w-full rounded-[24px] border border-[#d9cfbd] bg-[#fffaf1] p-3 shadow-[0_22px_70px_rgba(15,23,42,0.18)]">
            <input
              aria-label={`Cerca ${label.toLowerCase()}`}
              autoFocus
              className={fieldClassName}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Cerca ${label.toLowerCase()}`}
              value={search}
            />
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
              {filteredPeople.length > 0 ? (
                filteredPeople.map((person) => (
                  <label
                    className="flex items-center gap-3 rounded-2xl border border-[#e9dcc3] bg-white px-3 py-3 text-sm text-slate-700"
                    key={person.id}
                  >
                    <input
                      checked={selectedIds.includes(person.id)}
                      className="h-4 w-4 rounded border-[#c7b79b] text-[#153524]"
                      onChange={(event) =>
                        onChange(toggleId(selectedIds, person.id, event.target.checked))
                      }
                      type="checkbox"
                    />
                    <span className="truncate">{getPersonDisplayName(person)}</span>
                  </label>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d9cfbd] px-4 py-6 text-sm text-slate-500">
                  Nessun risultato per questa ricerca.
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PersonEditorModal({
  mode,
  people,
  person,
  onClose,
  onDelete,
  onSave,
}: PersonEditorModalProps) {
  const [draft, setDraft] = useState<PersonRecord>(person);
  const titleId = useId();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose, firstInputRef);

  useEffect(() => {
    setDraft(person);
  }, [person]);

  const availableRelations = useMemo(
    () => people.filter((candidate) => candidate.id !== draft.id),
    [draft.id, people],
  );

  const updateDraft = <Key extends keyof PersonRecord>(key: Key, value: PersonRecord[Key]) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  };

  const title =
    mode === "create" ? "Crea una nuova scheda" : `Modifica ${getPersonDisplayName(draft)}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#06150d]/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-[#dfe5df] bg-white text-[#152219] shadow-[0_30px_100px_rgba(6,21,13,0.28)] outline-none"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="grid gap-6 border-b border-[#dfe5df] bg-[#f4f7f3] px-5 py-5 sm:px-6 sm:py-6 md:grid-cols-[200px_1fr]">
          <div className="flex min-h-48 items-end rounded-[20px] border border-[#cbd5cb] bg-white p-4">
            {draft.photo ? (
              <img
                alt={title}
                className="h-full max-h-52 w-full rounded-[16px] object-cover"
                src={draft.photo}
              />
            ) : (
              <div className="flex h-full min-h-40 w-full items-center justify-center rounded-[16px] border border-dashed border-[#b9c5b8] bg-[#edf2e9] font-[family-name:var(--font-display)] text-5xl text-[#0c3b24]">
                {(draft.name || title).slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#65746a]">
                  {mode === "create" ? "Nuova persona" : "Editor scheda"}
                </p>
                <h2
                  className="mt-2 font-[family-name:var(--font-display)] text-4xl leading-none text-[#17351f]"
                  id={titleId}
                >
                  {title}
                </h2>
                <p className="mt-2 text-sm text-[#526158]">
                  Usa la stessa struttura della scheda persona e salva quando i dati sono coerenti.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "edit" && draft.id && onDelete ? (
                  <button
                    className="min-h-11 rounded-xl border border-[#d8a5a5] bg-white px-4 text-sm font-medium text-[#8b3030] outline-none transition hover:border-[#b86c6c] focus-visible:ring-2 focus-visible:ring-[#8b3030] focus-visible:ring-offset-2"
                    onClick={() => onDelete(draft.id)}
                    type="button"
                  >
                    Elimina
                  </button>
                ) : null}
                <button
                  className="min-h-11 rounded-xl border border-[#b9c5b8] bg-white px-4 text-sm font-medium text-[#17351f] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                  onClick={onClose}
                  type="button"
                >
                  Chiudi
                </button>
              </div>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-[#34443a]">
              Le relazioni si selezionano da dropdown con ricerca integrata, per evitare liste lunghe e poco leggibili.
            </p>
          </div>
        </div>

        <form
          className="grid gap-4 px-6 py-6 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSave(draft);
          }}
        >
          <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Anagrafica</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Nome</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  placeholder="Mario"
                  ref={firstInputRef}
                  required
                  value={draft.name}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Cognome</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("surname", event.target.value || null)}
                  placeholder="Rossi"
                  value={draft.surname ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Nome noto</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("knownAs", event.target.value || null)}
                  placeholder="Mimmo"
                  value={draft.knownAs ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Sesso</span>
                <select
                  className={fieldClassName}
                  onChange={(event) => updateDraft("sex", (event.target.value || null) as PersonSex)}
                  value={draft.sex ?? ""}
                >
                  <option value="">Non indicato</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="nonbinary">Nonbinary</option>
                  <option value="unknown">Unknown</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Data di nascita</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("birthDate", event.target.value || null)}
                  type="date"
                  value={draft.birthDate ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Luogo di nascita</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("birthPlace", event.target.value || null)}
                  value={draft.birthPlace ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Data di decesso</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("deathDate", event.target.value || null)}
                  type="date"
                  value={draft.deathDate ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Luogo di decesso</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("deathPlace", event.target.value || null)}
                  value={draft.deathPlace ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Professione</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("profession", event.target.value || null)}
                  value={draft.profession ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Istruzione</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("instruction", event.target.value || null)}
                  value={draft.instruction ?? ""}
                />
              </label>
            </div>
          </section>

          <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Relazioni</p>
            <div className="mt-4 space-y-4">
              <RelationDropdown
                label="Genitori"
                onChange={(nextIds) => updateDraft("parentIds", nextIds)}
                people={availableRelations}
                selectedIds={draft.parentIds}
              />
              <RelationDropdown
                label="Partner"
                onChange={(nextIds) => updateDraft("partnerIds", nextIds)}
                people={availableRelations}
                selectedIds={draft.partnerIds}
              />
              <RelationDropdown
                label="Figli"
                onChange={(nextIds) => updateDraft("childIds", nextIds)}
                people={availableRelations}
                selectedIds={draft.childIds}
              />
            </div>
          </section>

          <section className="rounded-[18px] border border-[#dfe5df] bg-white px-5 py-5 md:col-span-2">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Materiali e note</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Foto o URL immagine</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("photo", event.target.value || null)}
                  placeholder="https://..."
                  value={draft.photo ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Tags separati da virgola</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("tags", normalizeCommaSeparated(event.target.value))}
                  placeholder="raduno, archivio, ricerca"
                  value={draft.tags?.join(", ") ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Allegati separati da virgola</span>
                <input
                  className={fieldClassName}
                  onChange={(event) =>
                    updateDraft("attachments", normalizeCommaSeparated(event.target.value))
                  }
                  placeholder="Album 1972, Intervista audio 2004"
                  value={draft.attachments?.join(", ") ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Segni distintivi</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("distinguishingMarks", event.target.value || null)}
                  value={draft.distinguishingMarks ?? ""}
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Note</span>
                <textarea
                  className={`${fieldClassName} min-h-32`}
                  onChange={(event) => updateDraft("notes", event.target.value || null)}
                  value={draft.notes ?? ""}
                />
              </label>
            </div>
          </section>

          <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
            <button
              className="min-h-11 rounded-xl border border-[#cbd5cb] bg-white px-5 text-sm font-medium text-[#34443a] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
              onClick={onClose}
              type="button"
            >
              Annulla
            </button>
            <button
              className="min-h-11 rounded-xl bg-[#0c3b24] px-5 text-sm font-semibold text-white outline-none transition hover:bg-[#164d31] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
              type="submit"
            >
              {mode === "create" ? "Crea persona" : "Salva modifiche"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
