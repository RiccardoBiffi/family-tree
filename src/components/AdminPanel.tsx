"use client";

import { useEffect, useState } from "react";

import type { PersonRecord, PersonSex } from "@/models/Person";
import { createEmptyPersonDraft, getPersonDisplayName } from "@/utils/familyTree";

interface AdminPanelProps {
  people: PersonRecord[];
  selectedPerson: PersonRecord | null;
  onSelectPerson: (personId: string) => void;
  onCreatePerson: () => void;
  onSavePerson: (draft: PersonRecord) => void;
  onDeletePerson: (personId: string) => void;
  onResetDemoData: () => void;
}

const fieldClassName =
  "w-full rounded-2xl border border-[#d9cfbd] bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#5f8f63] focus:ring-4 focus:ring-[#5f8f63]/10";

function toggleId(ids: string[], id: string, nextChecked: boolean): string[] {
  if (nextChecked) {
    return ids.includes(id) ? ids : [...ids, id];
  }

  return ids.filter((currentId) => currentId !== id);
}

function RelationPicker({
  title,
  people,
  selectedIds,
  onChange,
}: {
  title: string;
  people: PersonRecord[];
  selectedIds: string[];
  onChange: (nextIds: string[]) => void;
}) {
  if (people.length === 0) {
    return (
      <div className="rounded-[22px] border border-dashed border-[#d9cfbd] px-4 py-4 text-sm text-slate-500">
        Nessuna persona disponibile.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        {people.map((person) => (
          <label
            className="flex items-center gap-3 rounded-2xl border border-[#d9cfbd] bg-white px-3 py-3 text-sm text-slate-700"
            key={person.id}
          >
            <input
              checked={selectedIds.includes(person.id)}
              className="h-4 w-4 rounded border-[#c7b79b] text-[#153524]"
              onChange={(event) => onChange(toggleId(selectedIds, person.id, event.target.checked))}
              type="checkbox"
            />
            <span>{getPersonDisplayName(person)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function AdminPanel({
  people,
  selectedPerson,
  onSelectPerson,
  onCreatePerson,
  onSavePerson,
  onDeletePerson,
  onResetDemoData,
}: AdminPanelProps) {
  const [draft, setDraft] = useState<PersonRecord>(createEmptyPersonDraft());

  useEffect(() => {
    setDraft(selectedPerson ?? createEmptyPersonDraft());
  }, [selectedPerson]);

  const availableRelations = people.filter((person) => person.id !== draft.id);

  const updateDraft = <Key extends keyof PersonRecord>(key: Key, value: PersonRecord[Key]) => {
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }));
  };

  const handleDelete = () => {
    if (!draft.id) {
      return;
    }

    if (window.confirm("Eliminare questa persona dall'albero genealogico?")) {
      onDeletePerson(draft.id);
      onCreatePerson();
    }
  };

  return (
    <aside className="space-y-5">
      <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Modalita&apos; amministratore</p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl text-slate-900">
              Gestione anagrafica e relazioni
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
          Tutte le modifiche restano nel local storage del browser corrente. Nessun dato viene inviato al server.
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
            <h3 className="text-lg font-semibold text-slate-900">Schede esistenti</h3>
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
                person.id === draft.id
                  ? "border-[#5f8f63] bg-white text-[#153524]"
                  : "border-[#d9cfbd] bg-white/60 text-slate-700 hover:border-[#5f8f63]",
              ].join(" ")}
              key={person.id}
              onClick={() => onSelectPerson(person.id)}
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

      <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] p-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">
              {draft.id ? "Modifica persona" : "Nuova persona"}
            </p>
            <h3 className="text-lg font-semibold text-slate-900">
              {draft.id ? getPersonDisplayName(draft) : "Crea una nuova scheda"}
            </h3>
          </div>
          {draft.id ? (
            <button
              className="rounded-full border border-[#e5c3c3] bg-white px-4 py-2 text-sm font-medium text-[#8b3030] transition hover:border-[#c85d5d]"
              onClick={handleDelete}
              type="button"
            >
              Elimina
            </button>
          ) : null}
        </div>

        <form
          className="mt-5 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSavePerson(draft);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
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

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Foto o URL immagine</span>
            <input
              className={fieldClassName}
              onChange={(event) => updateDraft("photo", event.target.value || null)}
              placeholder="https://..."
              value={draft.photo ?? ""}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Tags separati da virgola</span>
            <input
              className={fieldClassName}
              onChange={(event) =>
                updateDraft(
                  "tags",
                  event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                )
              }
              placeholder="raduno, archivio, ricerca"
              value={draft.tags?.join(", ") ?? ""}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Allegati separati da virgola</span>
            <input
              className={fieldClassName}
              onChange={(event) =>
                updateDraft(
                  "attachments",
                  event.target.value
                    .split(",")
                    .map((value) => value.trim())
                    .filter(Boolean),
                )
              }
              placeholder="Album 1972, Intervista audio 2004"
              value={draft.attachments?.join(", ") ?? ""}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Segni distintivi</span>
            <textarea
              className={`${fieldClassName} min-h-24`}
              onChange={(event) => updateDraft("distinguishingMarks", event.target.value || null)}
              value={draft.distinguishingMarks ?? ""}
            />
          </label>

          <label className="block space-y-2">
            <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Note</span>
            <textarea
              className={`${fieldClassName} min-h-32`}
              onChange={(event) => updateDraft("notes", event.target.value || null)}
              value={draft.notes ?? ""}
            />
          </label>

          <RelationPicker
            onChange={(nextIds) => updateDraft("parentIds", nextIds)}
            people={availableRelations}
            selectedIds={draft.parentIds}
            title="Genitori"
          />
          <RelationPicker
            onChange={(nextIds) => updateDraft("partnerIds", nextIds)}
            people={availableRelations}
            selectedIds={draft.partnerIds}
            title="Partner"
          />
          <RelationPicker
            onChange={(nextIds) => updateDraft("childIds", nextIds)}
            people={availableRelations}
            selectedIds={draft.childIds}
            title="Figli"
          />

          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-full border border-[#d9cfbd] bg-white px-5 py-3 text-sm font-medium text-slate-700 transition hover:border-[#5f8f63] hover:text-[#153524]"
              onClick={onCreatePerson}
              type="button"
            >
              Annulla
            </button>
            <button
              className="rounded-full bg-[#153524] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#204b33]"
              type="submit"
            >
              Salva persona
            </button>
          </div>
        </form>
      </section>
    </aside>
  );
}
