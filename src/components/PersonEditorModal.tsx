"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useId, useMemo, useRef, useState } from "react";

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
  "w-full rounded-2xl border border-[#d9cfbd] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#5f8f63] focus:ring-4 focus:ring-[#5f8f63]/10";

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
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
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

  useEffect(() => {
    setDraft(person);
  }, [person]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

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
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#faf5eb] text-slate-900 shadow-[0_30px_120px_rgba(15,23,42,0.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="grid gap-6 border-b border-slate-900/10 bg-[linear-gradient(140deg,#153524_0%,#1f5135_52%,#d4b26f_100%)] px-6 py-6 text-white md:grid-cols-[220px_1fr]">
          <div className="flex min-h-56 items-end rounded-[24px] border border-white/20 bg-white/10 p-5">
            {draft.photo ? (
              <img
                alt={title}
                className="h-full max-h-56 w-full rounded-[18px] object-cover"
                src={draft.photo}
              />
            ) : (
              <div className="flex h-full min-h-44 w-full items-center justify-center rounded-[18px] border border-dashed border-white/35 bg-black/10 text-5xl font-semibold">
                {(draft.name || title).slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.34em] text-white/70">
                  {mode === "create" ? "Nuova persona" : "Editor scheda"}
                </p>
                <h2 className="font-[family-name:var(--font-display)] text-4xl leading-none">
                  {title}
                </h2>
                <p className="mt-2 text-sm text-white/80">
                  Usa la stessa struttura della scheda persona e salva quando i dati sono coerenti.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {mode === "edit" && draft.id && onDelete ? (
                  <button
                    className="rounded-full border border-[#f3b8b8]/60 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/12"
                    onClick={() => onDelete(draft.id)}
                    type="button"
                  >
                    Elimina
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
          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Anagrafica</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Nome</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  placeholder="Mario"
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

          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm">
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

          <section className="rounded-[22px] border border-slate-900/10 bg-white px-5 py-5 shadow-sm md:col-span-2">
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
              className="rounded-full border border-[#d9cfbd] bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]"
              onClick={onClose}
              type="button"
            >
              Annulla
            </button>
            <button
              className="rounded-full bg-[#153524] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#204b33]"
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
