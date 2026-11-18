"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { ArchiveActions } from "@/components/ArchiveActions";
import { ArchiveIcon } from "@/components/ArchiveIcon";
import { ArchiveOnboarding } from "@/components/ArchiveOnboarding";
import { FamilyFocusView, getDefaultFamilyPerson } from "@/components/FamilyFocusView";
import { FamilyTreeIssues } from "@/components/FamilyTreeIssues";
import { PeopleTable } from "@/components/PeopleTable";
import {
  PersonEditorModal,
  type PersonMediaChanges,
} from "@/components/PersonEditorModal";
import { PersonModal } from "@/components/PersonModal";
import { TimelineView } from "@/components/TimelineView";
import { TreeDiagramView } from "@/components/TreeDiagramView";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import { useMediaViews } from "@/hooks/useMediaLibrary";
import {
  createMediaAssetReference,
  createMediaAssetRecord,
  parseMediaAssetReference,
  type MediaAssetRecord,
} from "@/models/MediaAsset";
import type { PersonRecord } from "@/models/Person";
import {
  ALBERO_FILE_EXTENSION,
  exportAlberoPackage,
  importAlberoPackage,
} from "@/utils/alberoPackage";
import {
  createEmptyPersonDraft,
  createPersonId,
  getFamilyTreeIssues,
  getPersonDisplayName,
} from "@/utils/familyTree";
import { ArchiveConflictError, MediaDBUpgradeBlockedError } from "@/utils/mediaDB";

type AppMode = "visitor" | "admin";
type AppView = "diagram" | "table" | "timeline";
type EditorState =
  | {
      mode: "create";
      draft: PersonRecord;
    }
  | {
      mode: "edit";
      personId: string;
    };

interface FamilyTreeAppProps {
  mode: AppMode;
}

const viewOptions: ReadonlyArray<{ id: AppView; label: string }> = [
  { id: "diagram", label: "Diagramma" },
  { id: "table", label: "Tabella" },
  { id: "timeline", label: "Cronologia" },
];
const emptyPeople: PersonRecord[] = [];
const emptyMediaIds: readonly string[] = [];
const archiveDateFormatter = new Intl.DateTimeFormat("it-IT", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function getArchiveTitle(title: string, familyName: string) {
  if (familyName.trim()) {
    return `Archivio ${familyName.trim()}`;
  }

  return title;
}

function formatArchiveDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return archiveDateFormatter
    .format(date)
    .replaceAll(".", "");
}

function createArchiveFileName(familyName: string): string {
  const slug =
    familyName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "famiglia";
  const date = new Date().toISOString().slice(0, 10);

  return `archivio-${slug}-${date}${ALBERO_FILE_EXTENSION}`;
}

function showSaveError(error: unknown) {
  let message = "";
  if (error instanceof ArchiveConflictError || error instanceof MediaDBUpgradeBlockedError) {
    message = error.message;
  } else if (error instanceof DOMException && error.name === "AbortError") {
    message = "La scrittura è stata interrotta. Riprova.";
  }
  const detail = message ? `\n\n${message}` : "";
  window.alert(
    `Non è stato possibile salvare l’archivio. Nessuna modifica è stata applicata.${detail}`,
  );
}

export function FamilyTreeApp({ mode }: FamilyTreeAppProps) {
  const {
    snapshot,
    assetIds,
    mediaEpoch,
    needsArchiveSetup,
    isVolatile,
    busy: archiveBusy,
    loadError,
    readAssets,
    readForExport,
    initializeArchive,
    replaceSnapshot,
    upsertPerson,
    deletePerson,
  } = useFamilyTreeStore();
  const [view, setView] = useState<AppView>("diagram");
  const [diagramMode, setDiagramMode] = useState<"overview" | "family">("overview");
  const [familyPersonId, setFamilyPersonId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [issuesDismissed, setIssuesDismissed] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const operationRef = useRef(false);
  const deferredQuery = useDeferredValue(query);
  const isAdmin = mode === "admin";
  const people = snapshot?.people ?? emptyPeople;
  const storedPeopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const portraitIds = useMemo(() => {
    if (!assetIds) {
      return emptyMediaIds;
    }
    return people.flatMap(({ photo }) => {
      const id = parseMediaAssetReference(photo);
      return id && assetIds.has(id) ? [id] : [];
    });
  }, [assetIds, people]);
  const portraits = useMediaViews(portraitIds, readAssets, mediaEpoch);
  const photoUrls = useMemo(() => {
    const photos = new Map<string, string>();
    for (const person of people) {
      const id = parseMediaAssetReference(person.photo);
      const url = id ? portraits.viewsById.get(id)?.url : person.photo;
      if (url) {
        photos.set(person.id, url);
      }
    }
    return photos;
  }, [people, portraits.viewsById]);
  const selectedStoredPerson = useMemo(
    () =>
      selectedPersonId
        ? storedPeopleById.get(selectedPersonId) ?? null
        : null,
    [selectedPersonId, storedPeopleById],
  );
  const selectedPerson = useMemo(
    () => selectedStoredPerson
      ? { ...selectedStoredPerson, photo: photoUrls.get(selectedStoredPerson.id) ?? null }
      : null,
    [photoUrls, selectedStoredPerson],
  );
  const editorStoredPerson = useMemo(() => {
    if (!editorState) {
      return null;
    }

    if (editorState.mode === "create") {
      return editorState.draft;
    }

    return snapshot
      ? storedPeopleById.get(editorState.personId) ?? null
      : null;
  }, [editorState, snapshot, storedPeopleById]);
  const editorPerson = useMemo(
    () =>
      editorStoredPerson
        ? {
            ...editorStoredPerson,
            photo: parseMediaAssetReference(editorStoredPerson.photo)
              ? null
              : editorStoredPerson.photo,
            attachments:
              editorStoredPerson.attachments?.filter((value) =>
                Boolean(parseMediaAssetReference(value)),
              ) ?? null,
          }
        : null,
    [editorStoredPerson],
  );
  const attachments = (editorStoredPerson ?? selectedStoredPerson)?.attachments;
  const attachmentIds = useMemo(() => {
    if (!attachments || !assetIds) {
      return emptyMediaIds;
    }
    return attachments.flatMap((reference) => {
      const id = parseMediaAssetReference(reference);
      return id && assetIds.has(id) ? [id] : [];
    });
  }, [assetIds, attachments]);
  const activeAttachments = useMediaViews(attachmentIds, readAssets, mediaEpoch);
  const activeMedia = useMemo(
    () => attachmentIds.flatMap((id) => {
      const media = activeAttachments.viewsById.get(id);
      return media ? [media] : [];
    }),
    [activeAttachments.viewsById, attachmentIds],
  );
  const editorPhoto = useMemo(() => {
    const assetId = parseMediaAssetReference(editorStoredPerson?.photo);
    return assetId ? portraits.viewsById.get(assetId) ?? null : null;
  }, [editorStoredPerson, portraits.viewsById]);
  const issues = useMemo(() => snapshot ? getFamilyTreeIssues(snapshot) : [], [snapshot]);
  const mediaWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (people.some(({ photo, attachments }) =>
      [photo, ...(attachments ?? [])].some((reference) => {
        const id = parseMediaAssetReference(reference);
        return id !== null && !assetIds?.has(id);
      }),
    )) {
      warnings.push("Mancano alcuni file multimediali. Puoi recuperarli importando un backup .albero completo.");
    }
    if (portraits.error || activeAttachments.error) {
      warnings.push("Non è stato possibile leggere alcuni file multimediali. Ricarica la pagina per riprovare.");
    }
    return warnings;
  }, [activeAttachments.error, assetIds, people, portraits.error]);
  const isEditorOpen =
    isAdmin && editorState !== null && editorPerson !== null;
  const isPersonModalOpen = selectedPerson !== null && !isEditorOpen;
  const showIssuesToast = issues.length > 0 && !issuesDismissed;

  const handleSelectPerson = useCallback((personId: string) => {
    setEditorState(null);
    setSelectedPersonId(personId);
    setFamilyPersonId(personId);
  }, []);

  const switchDiagramMode = (next: typeof diagramMode) => {
    if (next === diagramMode) return;
    if (!familyPersonId || !storedPeopleById.has(familyPersonId)) {
      setFamilyPersonId(getDefaultFamilyPerson(people)?.id ?? null);
    }
    setDiagramMode(next);
  };

  const showFamily = (personId: string) => {
    setFamilyPersonId(personId);
    setSelectedPersonId(null);
    setQuery("");
    setView("diagram");
    setDiagramMode("family");
  };

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (
      selectedPersonId &&
      !snapshot.people.some((person) => person.id === selectedPersonId)
    ) {
      setSelectedPersonId(null);
    }

    if (
      editorState?.mode === "edit" &&
      !snapshot.people.some((person) => person.id === editorState.personId)
    ) {
      setEditorState(null);
    }
  }, [editorState, selectedPersonId, snapshot]);

  useEffect(() => {
    if (!isAdmin && editorState) {
      setEditorState(null);
    }
  }, [editorState, isAdmin]);

  if (loadError) {
    return (
      <main className="family-tree-loading">
        <p role="alert">
          {loadError instanceof MediaDBUpgradeBlockedError
            ? loadError.message
            : "Impossibile aprire l’archivio. Ricarica la pagina per riprovare."}
        </p>
      </main>
    );
  }
  if (!snapshot) {
    return (
      <main aria-busy="true" className="family-tree-loading">
        <p>Sto preparando l&apos;archivio</p>
      </main>
    );
  }

  const archiveTitle = getArchiveTitle(
    snapshot.metadata.title,
    snapshot.metadata.familyName,
  );
  const archiveDate = formatArchiveDate(snapshot.metadata.updatedAt);
  const peopleLabel = `${snapshot.people.length} ${
    snapshot.people.length === 1 ? "persona" : "persone"
  }`;

  const handleCreatePerson = () => {
    if (!isAdmin || operationRef.current) {
      return;
    }
    setSelectedPersonId(null);
    setEditorState({ mode: "create", draft: createEmptyPersonDraft() });
  };

  const handleEditPerson = (personId: string) => {
    if (!isAdmin || operationRef.current) {
      return;
    }
    setSelectedPersonId(null);
    setEditorState({ mode: "edit", personId });
  };

  const handleSavePerson = async (
    draft: PersonRecord,
    mediaChanges: PersonMediaChanges,
  ) => {
    if (!isAdmin || operationRef.current) {
      return;
    }
    operationRef.current = true;
    try {
      const personId = draft.id || createPersonId();
      const existingPerson = storedPeopleById.get(personId);
      const removedAssetIds = new Set(mediaChanges.removedMediaIds);
      let photo = existingPerson?.photo ?? draft.photo;
      const previousPhotoId = parseMediaAssetReference(photo);
      if (previousPhotoId && (mediaChanges.removePhoto || mediaChanges.photoFile)) {
        removedAssetIds.add(previousPhotoId);
      }

      const newAssets: MediaAssetRecord[] = [];
      if (mediaChanges.removePhoto) {
        photo = null;
      } else if (mediaChanges.photoFile) {
        const asset = createMediaAssetRecord({
          personId,
          role: "photo",
          name: mediaChanges.photoFile.name,
          blob: mediaChanges.photoFile,
        });
        newAssets.push(asset);
        photo = createMediaAssetReference(asset.id);
      }

      const attachments = (existingPerson?.attachments ?? draft.attachments ?? [])
        .filter((reference) => {
          const id = parseMediaAssetReference(reference);
          return id && !removedAssetIds.has(id);
        });
      for (const file of mediaChanges.mediaFiles) {
        const asset = createMediaAssetRecord({
          personId,
          role: "attachment",
          name: file.name,
          blob: file,
        });
        newAssets.push(asset);
        attachments.push(createMediaAssetReference(asset.id));
      }

      const saved = await upsertPerson({
        ...draft,
        id: personId,
        photo,
        attachments: attachments.length ? attachments : null,
      }, { put: newAssets, remove: [...removedAssetIds] });
      if (saved) {
        setSelectedPersonId(personId);
        setEditorState(null);
      }
    } catch (error) {
      showSaveError(error);
    } finally {
      operationRef.current = false;
    }
  };

  const handleDeletePerson = async (personId: string) => {
    const person = storedPeopleById.get(personId);
    if (!isAdmin || !person || operationRef.current) {
      return;
    }
    const name = getPersonDisplayName(person);
    const confirmed = window.confirm(
      "Eliminare “" + name + "”? La persona e tutti i suoi contenuti multimediali saranno eliminati definitivamente.",
    );
    if (!confirmed) {
      return;
    }
    operationRef.current = true;
    try {
      if (await deletePerson(personId)) {
        setSelectedPersonId(null);
        setEditorState(null);
      }
    } catch (error) {
      showSaveError(error);
    } finally {
      operationRef.current = false;
    }
  };

  const handleExportArchive = async () => {
    const { snapshot: currentSnapshot, assets } = await readForExport();
    const archiveBlob = await exportAlberoPackage(currentSnapshot, assets);
    const downloadUrl = URL.createObjectURL(archiveBlob);
    const link = document.createElement("a");
    link.download = createArchiveFileName(currentSnapshot.metadata.familyName);
    link.href = downloadUrl;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  };

  const handleImportArchive = async (file: File) => {
    if (operationRef.current) {
      return false;
    }
    operationRef.current = true;
    try {
      const imported = await importAlberoPackage(file);
      const confirmed = needsArchiveSetup || window.confirm(
        `Importare “${file.name}”? L’archivio corrente sarà sostituito con ${imported.snapshot.people.length} persone e ${imported.assets.length} file multimediali.`,
      );
      if (!confirmed || !(await replaceSnapshot(imported.snapshot, imported.assets))) {
        return false;
      }
      setQuery("");
      setSelectedPersonId(null);
      setFamilyPersonId(null);
      setEditorState(null);
      setIssuesDismissed(false);
      setIssuesOpen(false);
      return true;
    } catch (error) {
      if (error instanceof ArchiveConflictError) {
        showSaveError(error);
      }
      throw error;
    } finally {
      operationRef.current = false;
    }
  };

  if (needsArchiveSetup) {
    return (
      <ArchiveOnboarding
        onImportArchive={handleImportArchive}
        onSubmit={async (name) => {
          if (operationRef.current) {
            return;
          }
          operationRef.current = true;
          try {
            await initializeArchive(name);
          } catch (error) {
            showSaveError(error);
          } finally {
            operationRef.current = false;
          }
        }}
      />
    );
  }

  return (
    <main className="family-tree-app">
      <header className="archive-shell-header">
        <div className="archive-identity">
          <h1>{archiveTitle}</h1>
          <p>
            {peopleLabel}
            <span aria-hidden="true"> · </span>
            <span>Aggiornato {archiveDate}</span>
          </p>
        </div>
        <ArchiveActions
          mode={mode}
          onCreatePerson={handleCreatePerson}
          onExportArchive={handleExportArchive}
          onImportArchive={handleImportArchive}
          onQueryChange={setQuery}
          query={query}
        />
        <nav
          aria-label="Visualizzazioni archivio"
          className="archive-view-navigation"
        >
          <div className="archive-view-tabs" role="tablist">
            {viewOptions.map((currentView) => (
              <button
                aria-controls="family-tree-view-panel"
                aria-selected={view === currentView.id}
                id={`family-tree-${currentView.id}-tab`}
                key={currentView.id}
                onClick={() => setView(currentView.id)}
                role="tab"
                type="button"
              >
                <ArchiveIcon
                  className="archive-view-tabs__icon"
                  name={currentView.id}
                />
                <span>{currentView.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </header>

      <section
        aria-labelledby={`family-tree-${view}-tab`}
        className="family-tree-view"
        data-view={view}
        id="family-tree-view-panel"
        role="tabpanel"
      >
        {isVolatile ? (
          <aside
            aria-live="polite"
            className="family-tree-warnings"
            role="status"
          >
            <strong>Archiviazione temporanea</strong>
            <div>
              <span>
                Il salvataggio permanente non è disponibile. I dati resteranno
                solo per questa sessione: esporta subito un file .albero per
                non perderli.
              </span>
            </div>
          </aside>
        ) : null}

        {mediaWarnings.length > 0 ? (
          <aside aria-live="polite" className="family-tree-warnings">
            <strong>File multimediali</strong>
            <div>
              {mediaWarnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          </aside>
        ) : null}

        {view === "diagram" ? (
          <div aria-label="Visualizzazione del diagramma" className="flex shrink-0 justify-center border-b border-[#dce4dc] bg-[#f7f9f6] px-2 py-1" role="group">
            {([["overview", "Albero completo"], ["family", "Famiglia vicina"]] as const).map(([id, label]) => (
              <button
                aria-pressed={diagramMode === id}
                className={`min-h-11 rounded-lg px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${diagramMode === id ? "bg-[#e1ebdf] text-[#163e28]" : "text-[#536358] hover:bg-[#ecf1eb]"}`}
                key={id}
                onClick={() => switchDiagramMode(id)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}
        {view === "diagram" && diagramMode === "overview" ? (
          <TreeDiagramView
            initialPersonId={familyPersonId}
            onSelectPerson={handleSelectPerson}
            people={people}
            photoUrls={photoUrls}
            query={deferredQuery}
            selectedPersonId={selectedPersonId}
          />
        ) : null}
        {view === "diagram" && diagramMode === "family" ? (
          <FamilyFocusView
            onNavigate={showFamily}
            onOpenPerson={handleSelectPerson}
            peopleById={storedPeopleById}
            personId={familyPersonId}
            query={deferredQuery}
          />
        ) : null}
        {view === "table" ? (
          <PeopleTable
            onSelectPerson={handleSelectPerson}
            people={people}
            query={query}
          />
        ) : null}
        {view === "timeline" ? (
          <TimelineView
            onSelectPerson={handleSelectPerson}
            people={people}
            query={deferredQuery}
          />
        ) : null}
      </section>

      {showIssuesToast ? (
        <aside aria-label="Avviso di coerenza" className="family-tree-issue-toast">
          <button
            aria-haspopup="dialog"
            className="min-h-11 flex-1 rounded-l-xl px-3 py-2 text-left leading-tight hover:bg-[#fde3e3] focus-visible:outline-2"
            onClick={() => setIssuesOpen(true)}
            tabIndex={isPersonModalOpen || isEditorOpen || issuesOpen ? -1 : undefined}
            type="button"
          >
            <span className="block text-sm font-semibold">Controlli di coerenza</span>
            <span className="block text-xs" role="status">
              {issues.length === 1 ? "1 criterio da verificare" : `${issues.length} criteri da verificare`}
            </span>
          </button>
          <button
            aria-label="Nascondi avviso di coerenza"
            className="min-h-11 min-w-11 shrink-0 rounded-r-xl border-l border-[#e5abab] text-xl hover:bg-[#fde3e3] focus-visible:outline-2"
            onClick={() => setIssuesDismissed(true)}
            tabIndex={isPersonModalOpen || isEditorOpen || issuesOpen ? -1 : undefined}
            type="button"
          >
            ×
          </button>
        </aside>
      ) : null}
      {issuesOpen && issues.length > 0 ? (
        <FamilyTreeIssues
          issues={issues}
          onClose={() => setIssuesOpen(false)}
          onSelectPerson={(id) => {
            setIssuesOpen(false);
            handleSelectPerson(id);
          }}
          peopleById={storedPeopleById}
        />
      ) : null}
      {isPersonModalOpen ? (
        <PersonModal
          media={activeMedia}
          onClose={() => setSelectedPersonId(null)}
          onShowFamily={view === "diagram" && diagramMode === "family" ? undefined : showFamily}
          onEdit={
            isAdmin && selectedPerson ? handleEditPerson : undefined
          }
          peopleById={storedPeopleById}
          person={selectedPerson}
        />
      ) : null}
      {isEditorOpen ? (
        <PersonEditorModal
          busy={archiveBusy}
          existingMedia={activeMedia}
          existingPhoto={editorPhoto}
          mode={editorState.mode}
          onClose={() => setEditorState(null)}
          onDelete={
            editorState.mode === "edit"
              ? handleDeletePerson
              : undefined
          }
          onSave={handleSavePerson}
          people={people}
          person={editorPerson}
        />
      ) : null}
    </main>
  );
}
