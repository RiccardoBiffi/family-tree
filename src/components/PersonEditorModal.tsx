"use client";
/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { useDialogFocus } from "@/hooks/useDialogFocus";
import { DEFAULT_ALLOWED_MEDIA_MIME_TYPES } from "@/models/MediaAsset";
import { isPersonYear, PERSON_SEX_LABELS, type PersonRecord, type PersonSex } from "@/models/Person";
import { getBiologicalParentIds, getPersonDisplayName, getPersonShortName } from "@/utils/familyTree";

export type PersonMediaKind = "image" | "audio" | "video" | "pdf" | "file";

export interface PersonPhotoView {
  id: string;
  fileName: string;
  url: string;
}

export interface PersonMediaView extends PersonPhotoView {
  kind: PersonMediaKind;
}

export interface PersonMediaChanges {
  photoFile: File | null;
  removePhoto: boolean;
  mediaFiles: File[];
  removedMediaIds: string[];
}

export interface PersonEditorModalProps {
  mode: "create" | "edit";
  busy?: boolean;
  people: PersonRecord[];
  person: PersonRecord;
  existingMedia?: readonly PersonMediaView[];
  existingPhoto?: PersonPhotoView | null;
  onClose: () => void;
  onDelete?: (personId: string) => void;
  onSave: (draft: PersonRecord, mediaChanges: PersonMediaChanges) => void;
}

const fieldClassName =
  "min-h-11 w-full rounded-xl border border-[#cbd5cb] bg-white px-4 py-3 text-sm text-[#152219] outline-none transition focus:border-[#78907c] focus:ring-4 focus:ring-[#0c3b24]/10";
const PHOTO_ACCEPT = DEFAULT_ALLOWED_MEDIA_MIME_TYPES.filter((mimeType) =>
  mimeType.startsWith("image/"),
).join(",");
const MEDIA_ACCEPT = DEFAULT_ALLOWED_MEDIA_MIME_TYPES.join(",");

const mediaKindLabels: Record<PersonMediaKind, string> = {
  image: "Immagine",
  audio: "Audio",
  video: "Video",
  pdf: "PDF",
  file: "File",
};

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

function formatCommaSeparated(values: string[] | null): string {
  return values?.join(", ") ?? "";
}

interface PersonDateDraft {
  yearOnly: boolean;
  fullDate: string;
  year: string;
}

function createDateDraft(value: string | null): PersonDateDraft {
  const yearOnly = isPersonYear(value);
  return {
    yearOnly,
    fullDate: yearOnly ? "" : value ?? "",
    year: value?.slice(0, 4) ?? "",
  };
}

function getDateDraftValue({ yearOnly, fullDate, year }: PersonDateDraft): string | null {
  return (yearOnly ? year : fullDate) || null;
}

function getDateDraftError({ yearOnly, fullDate, year }: PersonDateDraft): string | null {
  if (yearOnly && year && !isPersonYear(year)) {
    return "Inserisci un anno di quattro cifre tra 0001 e 9999.";
  }
  if (!yearOnly && !fullDate && year) {
    return "Inserisci la data completa o seleziona «Solo anno».";
  }
  return null;
}

function PersonDateField({
  label,
  yearLabel,
  name,
  draft,
  error,
  onChange,
}: {
  label: string;
  yearLabel: string;
  name: "birthDate" | "deathDate";
  draft: PersonDateDraft;
  error: string | null;
  onChange: (draft: PersonDateDraft) => void;
}) {
  const errorId = useId();
  const { yearOnly, fullDate, year } = draft;

  return (
    <div className="min-w-0">
      <label className="block space-y-2">
        <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</span>
        <input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          className={fieldClassName}
          inputMode={yearOnly ? "numeric" : undefined}
          name={name}
          onChange={(event) => {
            const value = event.target.value;
            onChange(yearOnly
              ? { ...draft, year: value }
              : { ...draft, fullDate: value, year: value.slice(0, 4) });
          }}
          placeholder={yearOnly ? "AAAA" : undefined}
          type={yearOnly ? "text" : "date"}
          value={yearOnly ? year : fullDate}
        />
      </label>
      <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input
          aria-label={yearLabel}
          checked={yearOnly}
          className="size-4 accent-[#0c3b24]"
          onChange={(event) => onChange({ ...draft, yearOnly: event.target.checked })}
          type="checkbox"
        />
        Solo anno
      </label>
      {error ? <p className="text-sm text-[#8b3030]" id={errorId} role="alert">{error}</p> : null}
    </div>
  );
}

function RelationDropdown({
  label,
  maxSelections,
  people,
  selectedIds,
  onChange,
}: {
  label: string;
  maxSelections?: number;
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
            {maxSelections === undefined ? selectedIds.length : `${selectedIds.length}/${maxSelections}`}
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
                      disabled={
                        maxSelections !== undefined &&
                        selectedIds.length >= maxSelections &&
                        !selectedIds.includes(person.id)
                      }
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
  busy = false,
  people,
  person,
  existingMedia = [],
  existingPhoto = null,
  onClose,
  onDelete,
  onSave,
}: PersonEditorModalProps) {
  const [draft, setDraft] = useState<PersonRecord>(person);
  const titleId = useId();
  const [tagsText, setTagsText] = useState(() => formatCommaSeparated(person.tags));
  const [birthDateDraft, setBirthDateDraft] = useState(() => createDateDraft(person.birthDate));
  const [deathDateDraft, setDeathDateDraft] = useState(() => createDateDraft(person.deathDate));
  const [showDateErrors, setShowDateErrors] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const formId = useId();
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setDraft(person);
    setTagsText(formatCommaSeparated(person.tags));
    setBirthDateDraft(createDateDraft(person.birthDate));
    setDeathDateDraft(createDateDraft(person.deathDate));
    setShowDateErrors(false);
    setPhotoFile(null);
    setRemovePhoto(false);
    setMediaFiles([]);
    setRemovedMediaIds([]);
  }, [person]);

  useEffect(() => {
    if (!photoFile || typeof URL.createObjectURL !== "function") {
      setPhotoPreviewUrl(null);
      return;
    }

    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(previewUrl);

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [photoFile]);

  const initialTagsText = formatCommaSeparated(person.tags);
  const birthDate = getDateDraftValue(birthDateDraft);
  const deathDate = getDateDraftValue(deathDateDraft);
  const birthDateError = getDateDraftError(birthDateDraft);
  const deathDateError = getDateDraftError(deathDateDraft);
  const hasUnsavedChanges = useMemo(
    () =>
      JSON.stringify(draft) !== JSON.stringify(person) ||
      tagsText !== initialTagsText ||
      birthDate !== person.birthDate ||
      deathDate !== person.deathDate ||
      photoFile !== null ||
      removePhoto ||
      mediaFiles.length > 0 ||
      removedMediaIds.length > 0,
    [
      birthDate,
      deathDate,
      draft,
      initialTagsText,
      mediaFiles.length,
      person,
      photoFile,
      removePhoto,
      removedMediaIds.length,
      tagsText,
    ],
  );
  const requestClose = useCallback(() => {
    if (busy) {
      return;
    }
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "Hai modifiche non salvate. Vuoi chiudere e perdere i dati inseriti?",
      )
    ) {
      return;
    }

    onClose();
  }, [busy, hasUnsavedChanges, onClose]);
  const dialogRef = useDialogFocus<HTMLDivElement>(true, requestClose, firstInputRef);

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

  const biologicalIds = getBiologicalParentIds(draft);
  const adoptiveIds = draft.parentIds.filter((id) => !biologicalIds.includes(id));
  const diagramIds = draft.diagramParentIds ?? [];
  const setParents = (role: "biological" | "adoptive", selected: string[]) => {
    const nextBiological = role === "biological"
      ? selected
      : biologicalIds.filter((id) => !selected.includes(id));
    const nextAdoptive = role === "adoptive"
      ? selected
      : adoptiveIds.filter((id) => !selected.includes(id));
    const parentIds = draft.parentIds.filter(
      (id) => nextBiological.includes(id) || nextAdoptive.includes(id),
    );
    const retainedIds = new Set(parentIds);
    for (const id of [...nextBiological, ...nextAdoptive]) {
      if (!retainedIds.has(id)) parentIds.push(id);
    }
    setDraft({
      ...draft,
      parentIds,
      biologicalParentIds: nextBiological,
      diagramParentIds: parentIds.length > 2
        ? diagramIds.filter((id) => parentIds.includes(id))
        : undefined,
    });
  };

  const currentPhotoUrl = photoFile
    ? photoPreviewUrl
    : removePhoto
      ? null
      : existingPhoto?.url ?? draft.photo;
  const hasOriginalPhoto = Boolean(existingPhoto?.url ?? draft.photo);

  const choosePhoto = () => {
    photoInputRef.current?.click();
  };

  const removeCurrentPhoto = () => {
    setPhotoFile(null);
    setRemovePhoto(hasOriginalPhoto);
  };

  const toggleMediaRemoval = (mediaId: string) => {
    setRemovedMediaIds((currentIds) =>
      currentIds.includes(mediaId)
        ? currentIds.filter((currentId) => currentId !== mediaId)
        : [...currentIds, mediaId],
    );
  };

  const title =
    mode === "create" ? "Crea una nuova scheda" : `Modifica ${getPersonDisplayName(draft)}`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[#06150d]/50 px-3 py-4 backdrop-blur-[2px] sm:px-6 sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        aria-labelledby={titleId}
        aria-busy={busy}
        aria-modal="true"
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-[#dfe5df] bg-white text-[#152219] shadow-[0_30px_100px_rgba(6,21,13,0.28)] outline-none"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="sticky top-0 z-30 grid grid-cols-[72px_minmax(0,1fr)] gap-3 border-b border-[#dfe5df] bg-[#f4f7f3]/[0.98] px-4 py-4 shadow-[0_8px_24px_rgba(12,59,36,0.06)] backdrop-blur sm:px-5 md:grid-cols-[132px_minmax(0,1fr)] md:gap-5 md:px-6">
          <div className="relative min-h-20 rounded-[16px] border border-[#cbd5cb] bg-white p-2 md:min-h-32 md:p-3">
            <input
              accept={PHOTO_ACCEPT}
              aria-label="Seleziona foto"
              className="sr-only"
              onChange={(event) => {
                const nextPhotoFile = event.target.files?.[0] ?? null;
                if (nextPhotoFile) {
                  setPhotoFile(nextPhotoFile);
                  setRemovePhoto(false);
                }
                event.target.value = "";
              }}
              ref={photoInputRef}
              tabIndex={-1}
              type="file"
            />
            <button
              aria-label={currentPhotoUrl ? "Sostituisci foto" : "Aggiungi foto"}
              className="group relative flex h-full min-h-16 w-full items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-[#b9c5b8] bg-[#edf2e9] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2 md:min-h-28"
              onClick={choosePhoto}
              type="button"
            >
              {currentPhotoUrl ? (
                <img
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  src={currentPhotoUrl}
                />
              ) : (
                <span className="font-[family-name:var(--font-display)] text-2xl text-[#0c3b24] md:text-4xl">
                  {(draft.name || title).slice(0, 2).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-x-2 bottom-2 flex min-h-11 items-center justify-center rounded-xl bg-[#0c3b24]/90 text-white opacity-100 shadow-sm transition md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="M4 8.5h3l1.4-2h7.2l1.4 2h3v9H4z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
                  <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              </span>
            </button>
            {currentPhotoUrl ? (
              <button
                aria-label="Rimuovi foto"
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white text-[#8b3030] shadow-md outline-none transition hover:bg-[#fff5f5] focus-visible:ring-2 focus-visible:ring-[#8b3030] focus-visible:ring-offset-2 md:right-2 md:top-2"
                onClick={removeCurrentPhoto}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12M10 10v6m4-6v6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </button>
            ) : removePhoto ? (
              <button
                aria-label="Ripristina foto"
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-xl border border-white/80 bg-white text-[#17351f] shadow-md outline-none transition hover:bg-[#edf2e9] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2 md:right-2 md:top-2"
                onClick={() => setRemovePhoto(false)}
                type="button"
              >
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="M5 8v5h5M6.6 16.5A7 7 0 1 0 6 8.6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
                </svg>
              </button>
            ) : null}
          </div>
          <div className="min-w-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#65746a]">
                  {mode === "create" ? "Nuova persona" : "Editor scheda"}
                </p>
                <h2
                  className="mt-1 line-clamp-2 font-[family-name:var(--font-display)] text-2xl leading-tight text-[#17351f] md:text-3xl"
                  id={titleId}
                >
                  {title}
                </h2>
              </div>
              <div className="flex flex-wrap gap-2 md:justify-end">
                {mode === "edit" && draft.id && onDelete ? (
                  <button
                    className="min-h-11 rounded-xl border border-[#d8a5a5] bg-white px-3 text-sm font-medium text-[#8b3030] outline-none transition hover:border-[#b86c6c] focus-visible:ring-2 focus-visible:ring-[#8b3030] focus-visible:ring-offset-2"
                    disabled={busy}
                    onClick={() => onDelete(draft.id)}
                    type="button"
                  >
                    Elimina
                  </button>
                ) : null}
                <button
                  className="min-h-11 rounded-xl bg-[#0c3b24] px-4 text-sm font-semibold text-white outline-none transition hover:bg-[#164d31] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                  disabled={busy}
                  form={formId}
                  type="submit"
                >
                  {mode === "create" ? "Crea persona" : "Salva modifiche"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <form
          className="grid gap-4 px-6 py-6 md:grid-cols-2"
          id={formId}
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) {
              return;
            }
            if (birthDateError || deathDateError) {
              setShowDateErrors(true);
              const field = event.currentTarget.elements.namedItem(birthDateError ? "birthDate" : "deathDate");
              if (field instanceof HTMLInputElement) {
                field.focus();
              }
              return;
            }
            onSave(
              {
                ...draft,
                birthDate,
                deathDate,
                tags: normalizeCommaSeparated(tagsText),
              },
              {
                mediaFiles: [...mediaFiles],
                photoFile,
                removePhoto: photoFile ? false : removePhoto,
                removedMediaIds: [...removedMediaIds],
              },
            );
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
                  {Object.entries(PERSON_SEX_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <PersonDateField
                draft={birthDateDraft}
                error={showDateErrors ? birthDateError : null}
                label="Data di nascita"
                name="birthDate"
                onChange={setBirthDateDraft}
                yearLabel="Solo anno di nascita"
              />
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Luogo di nascita</span>
                <input
                  className={fieldClassName}
                  onChange={(event) => updateDraft("birthPlace", event.target.value || null)}
                  value={draft.birthPlace ?? ""}
                />
              </label>
              <PersonDateField
                draft={deathDateDraft}
                error={showDateErrors ? deathDateError : null}
                label="Data di decesso"
                name="deathDate"
                onChange={setDeathDateDraft}
                yearLabel="Solo anno di decesso"
              />
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
              {draft.parentIds.length > 2 && draft.biologicalParentIds === undefined ? (
                <p className="text-sm text-[#526158]">
                  I tipi di genitore sono proposti in base all’ordine del vecchio archivio. Verificali prima di salvare.
                </p>
              ) : null}
              <RelationDropdown
                label="Genitori biologici"
                maxSelections={2}
                onChange={(nextIds) => setParents("biological", nextIds)}
                people={availableRelations}
                selectedIds={biologicalIds}
              />
              <RelationDropdown
                label="Genitori adottivi"
                onChange={(nextIds) => setParents("adoptive", nextIds)}
                people={availableRelations}
                selectedIds={adoptiveIds}
              />
              {draft.parentIds.length > 2 ? (
                <div className="space-y-2">
                  <RelationDropdown
                    label="Genitori nel diagramma"
                    maxSelections={2}
                    onChange={(nextIds) => updateDraft("diagramParentIds", nextIds)}
                    people={availableRelations.filter(({ id }) => draft.parentIds.includes(id))}
                    selectedIds={diagramIds}
                  />
                  <p className="text-sm text-[#526158]">
                    Seleziona due genitori per mostrare la discendenza nel diagramma.
                  </p>
                </div>
              ) : null}
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
              <div className="space-y-3 rounded-2xl border border-[#dfe5df] bg-[#f8faf7] p-4 md:col-span-2">
                <div>
                  <p className="text-sm font-semibold text-[#17351f]">Contenuti multimediali</p>
                  <p className="mt-1 text-sm text-slate-600">
                    Aggiungi immagini, audio, video o PDF dal dispositivo.
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                    Aggiungi contenuti multimediali
                  </span>
                  <input
                    accept={MEDIA_ACCEPT}
                    className="block min-h-11 w-full rounded-xl border border-[#cbd5cb] bg-white px-3 py-2 text-sm text-[#152219] file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-[#e8efe8] file:px-4 file:text-sm file:font-semibold file:text-[#17351f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                    multiple
                    onChange={(event) => {
                      const nextFiles = Array.from(event.target.files ?? []);
                      if (nextFiles.length > 0) {
                        setMediaFiles((currentFiles) => [...currentFiles, ...nextFiles]);
                      }
                      event.target.value = "";
                    }}
                    type="file"
                  />
                </label>
                {existingMedia.length > 0 ? (
                  <ul aria-label="Contenuti multimediali esistenti" className="space-y-2">
                    {existingMedia.map((media) => {
                      const isRemoved = removedMediaIds.includes(media.id);

                      return (
                        <li
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#dfe5df] bg-white px-3 py-2"
                          key={media.id}
                        >
                          <div className="min-w-0">
                            <a
                              className={`flex min-h-11 items-center break-all text-sm font-medium underline decoration-[#a9b8aa] underline-offset-4 ${
                                isRemoved ? "text-slate-400 line-through" : "text-[#17351f]"
                              }`}
                              href={media.url}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {media.fileName}
                            </a>
                            <span className="text-xs text-slate-500">
                              {mediaKindLabels[media.kind]}
                              {isRemoved ? " · Verrà rimosso al salvataggio" : ""}
                            </span>
                          </div>
                          <button
                            aria-label={`${isRemoved ? "Ripristina" : "Rimuovi"} ${media.fileName}`}
                            className="min-h-11 rounded-xl border border-[#cbd5cb] bg-white px-3 text-sm font-semibold text-[#17351f] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                            onClick={() => toggleMediaRemoval(media.id)}
                            type="button"
                          >
                            {isRemoved ? "Ripristina" : "Rimuovi"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {mediaFiles.length > 0 ? (
                  <ul aria-label="Nuovi contenuti multimediali" className="space-y-2">
                    {mediaFiles.map((file, index) => (
                      <li
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b9c5b8] bg-white px-3 py-2"
                        key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                      >
                        <span className="min-w-0 break-all text-sm font-medium text-[#17351f]">
                          {file.name}
                        </span>
                        <button
                          aria-label={`Rimuovi nuovo contenuto ${file.name}`}
                          className="min-h-11 rounded-xl border border-[#cbd5cb] bg-white px-3 text-sm font-semibold text-[#17351f] outline-none transition hover:border-[#78907c] focus-visible:ring-2 focus-visible:ring-[#0c3b24] focus-visible:ring-offset-2"
                          onClick={() =>
                            setMediaFiles((currentFiles) =>
                              currentFiles.filter((_, currentIndex) => currentIndex !== index),
                            )
                          }
                          type="button"
                        >
                          Rimuovi
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <label className="space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Etichette separate da virgola
                </span>
                <input
                  className={fieldClassName}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="raduno, archivio, ricerca"
                  value={tagsText}
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

        </form>
      </div>
    </div>
  );
}
