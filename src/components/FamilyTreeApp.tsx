"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { ArchiveActions } from "@/components/ArchiveActions";
import { ArchiveIcon } from "@/components/ArchiveIcon";
import { ArchiveOnboarding } from "@/components/ArchiveOnboarding";
import { PeopleTable } from "@/components/PeopleTable";
import {
  PersonEditorModal,
  type PersonMediaChanges,
} from "@/components/PersonEditorModal";
import { PersonModal } from "@/components/PersonModal";
import { TimelineView } from "@/components/TimelineView";
import { TreeDiagramView } from "@/components/TreeDiagramView";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import { useMediaLibrary } from "@/hooks/useMediaLibrary";
import {
  createMediaAssetReference,
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
  addMissingDemoMediaReferences,
  hasCompletedDemoMediaMigration,
  markDemoMediaMigrationComplete,
  removeLegacyAttachmentValues,
} from "@/utils/demoMediaMigration";
import {
  createEmptyPersonDraft,
  createPersonId,
  getPersonDisplayName,
  validateFamilyTree,
} from "@/utils/familyTree";

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
  { id: "timeline", label: "Timeline" },
];
const emptyPeople: PersonRecord[] = [];

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

  return new Intl.DateTimeFormat("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replaceAll(".", "");
}

function getPersonMediaAssetIds(person: PersonRecord): string[] {
  return [person.photo, ...(person.attachments ?? [])]
    .map((value) => parseMediaAssetReference(value))
    .filter((assetId): assetId is string => Boolean(assetId));
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
  const detail =
    error instanceof Error && error.message
      ? `\n\nDettaglio: ${error.message}`
      : "";
  window.alert(
    `Non è stato possibile salvare i media locali. Nessuna modifica è stata applicata.${detail}`,
  );
}

export function FamilyTreeApp({ mode }: FamilyTreeAppProps) {
  const {
    snapshot,
    isLoaded,
    needsArchiveSetup,
    persistenceStatus: snapshotPersistenceStatus,
    initializeArchive,
    replaceSnapshot,
    upsertPerson,
    deletePerson,
  } = useFamilyTreeStore();
  const {
    viewsById,
    isReady: isMediaReady,
    error: mediaError,
    persistenceStatus: mediaPersistenceStatus,
    refreshAssets,
    replaceAssets,
    ensureDemoAssets,
    createAssetFromFile,
  } = useMediaLibrary();
  const [view, setView] = useState<AppView>("diagram");
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const didMigrateDemoMediaRef = useRef(false);
  const deferredQuery = useDeferredValue(query);
  const isAdmin = mode === "admin";
  const persistenceStatus =
    snapshotPersistenceStatus === "volatile" ||
    mediaPersistenceStatus === "volatile"
      ? "volatile"
      : "durable";
  const people = snapshot?.people ?? emptyPeople;
  const storedPeopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const displayPeople = useMemo(
    () =>
      people.map((person) => {
        const photoAssetId = parseMediaAssetReference(person.photo);
        if (!photoAssetId) {
          return person;
        }

        return {
          ...person,
          photo: viewsById.get(photoAssetId)?.url ?? null,
        };
      }),
    [people, viewsById],
  );
  const peopleById = useMemo(
    () => new Map(displayPeople.map((person) => [person.id, person])),
    [displayPeople],
  );
  const selectedPerson = useMemo(
    () =>
      selectedPersonId && snapshot
        ? peopleById.get(selectedPersonId) ?? null
        : null,
    [peopleById, selectedPersonId, snapshot],
  );
  const selectedStoredPerson = useMemo(
    () =>
      selectedPersonId
        ? storedPeopleById.get(selectedPersonId) ?? null
        : null,
    [selectedPersonId, storedPeopleById],
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
  const selectedMedia = useMemo(
    () =>
      (selectedStoredPerson?.attachments ?? [])
        .map((attachment) => parseMediaAssetReference(attachment))
        .filter((assetId): assetId is string => Boolean(assetId))
        .map((assetId) => viewsById.get(assetId))
        .filter((asset) => asset !== undefined),
    [selectedStoredPerson, viewsById],
  );
  const editorPhoto = useMemo(() => {
    const assetId = parseMediaAssetReference(editorStoredPerson?.photo);
    return assetId ? viewsById.get(assetId) ?? null : null;
  }, [editorStoredPerson, viewsById]);
  const editorMedia = useMemo(
    () =>
      (editorStoredPerson?.attachments ?? [])
        .map((attachment) => parseMediaAssetReference(attachment))
        .filter((assetId): assetId is string => Boolean(assetId))
        .map((assetId) => viewsById.get(assetId))
        .filter((asset) => asset !== undefined),
    [editorStoredPerson, viewsById],
  );
  const warnings = useMemo(() => {
    const treeWarnings = snapshot ? validateFamilyTree(snapshot) : [];
    return mediaError
      ? [
          ...treeWarnings,
          "I media locali non sono disponibili in questo browser.",
        ]
      : treeWarnings;
  }, [mediaError, snapshot]);
  const isEditorOpen =
    isAdmin && editorState !== null && editorPerson !== null;
  const isPersonModalOpen = selectedPerson !== null && !isEditorOpen;

  useEffect(() => {
    if (
      !snapshot ||
      needsArchiveSetup ||
      didMigrateDemoMediaRef.current
    ) {
      return;
    }

    didMigrateDemoMediaRef.current = true;
    let migratedSnapshot = snapshot;
    if (!hasCompletedDemoMediaMigration()) {
      migratedSnapshot =
        addMissingDemoMediaReferences(migratedSnapshot);
      markDemoMediaMigrationComplete();
    }

    migratedSnapshot =
      removeLegacyAttachmentValues(migratedSnapshot);
    if (migratedSnapshot !== snapshot) {
      replaceSnapshot(migratedSnapshot);
    }
  }, [needsArchiveSetup, replaceSnapshot, snapshot]);

  useEffect(() => {
    if (
      !snapshot ||
      needsArchiveSetup ||
      !isMediaReady ||
      mediaError
    ) {
      return;
    }

    const referencedAssetIds = snapshot.people.flatMap(
      getPersonMediaAssetIds,
    );
    void ensureDemoAssets(referencedAssetIds).catch((error: unknown) => {
      console.error("Unable to seed local demo media.", error);
    });
  }, [
    ensureDemoAssets,
    isMediaReady,
    mediaError,
    needsArchiveSetup,
    snapshot,
  ]);

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

  if (!isLoaded || !snapshot) {
    return (
      <main aria-busy="true" className="family-tree-loading">
        <p>Sto preparando l&apos;archivio</p>
      </main>
    );
  }

  if (needsArchiveSetup) {
    return <ArchiveOnboarding onSubmit={initializeArchive} />;
  }

  const archiveTitle = getArchiveTitle(
    snapshot.metadata.title,
    snapshot.metadata.familyName,
  );
  const archiveDate = formatArchiveDate(snapshot.metadata.updatedAt);
  const peopleLabel = `${snapshot.people.length} ${
    snapshot.people.length === 1 ? "persona" : "persone"
  }`;

  const handleSelectPerson = (personId: string) => {
    setEditorState(null);
    setSelectedPersonId(personId);
  };

  const handleCreatePerson = () => {
    if (!isAdmin) {
      return;
    }

    setSelectedPersonId(null);
    setEditorState({
      mode: "create",
      draft: createEmptyPersonDraft(),
    });
  };

  const handleEditPerson = (personId: string) => {
    if (!isAdmin) {
      return;
    }

    setSelectedPersonId(null);
    setEditorState({
      mode: "edit",
      personId,
    });
  };

  const handleSavePerson = async (
    draft: PersonRecord,
    mediaChanges: PersonMediaChanges,
  ) => {
    const personId = draft.id || createPersonId();
    let previousAssets: MediaAssetRecord[] | null = null;

    try {
      const existingPerson = storedPeopleById.get(personId);
      previousAssets = await refreshAssets();
      const removedAssetIds = new Set<string>(
        mediaChanges.removedMediaIds,
      );
      const existingPhotoAssetId = parseMediaAssetReference(
        existingPerson?.photo,
      );

      if (
        existingPhotoAssetId &&
        (mediaChanges.removePhoto || mediaChanges.photoFile)
      ) {
        removedAssetIds.add(existingPhotoAssetId);
      }

      let photo = existingPerson?.photo ?? draft.photo;
      const newAssets = [];

      if (mediaChanges.removePhoto) {
        photo = null;
      } else if (mediaChanges.photoFile) {
        const photoAsset = createAssetFromFile(
          personId,
          "photo",
          mediaChanges.photoFile,
        );
        newAssets.push(photoAsset);
        photo = createMediaAssetReference(photoAsset.id);
      }

      const retainedAttachmentAssetIds = (
        existingPerson?.attachments ?? draft.attachments ?? []
      )
        .map((value) => parseMediaAssetReference(value))
        .filter((assetId): assetId is string => Boolean(assetId))
        .filter((assetId) => !removedAssetIds.has(assetId));
      const newAttachmentAssets = mediaChanges.mediaFiles.map((file) =>
        createAssetFromFile(personId, "attachment", file),
      );
      newAssets.push(...newAttachmentAssets);
      const attachments = [
        ...retainedAttachmentAssetIds.map(createMediaAssetReference),
        ...newAttachmentAssets.map((asset) =>
          createMediaAssetReference(asset.id),
        ),
      ];
      const nextAssets = previousAssets
        .filter(
          (asset) =>
            asset.personId !== personId ||
            !removedAssetIds.has(asset.id),
        )
        .concat(newAssets);
      const nextPerson: PersonRecord = {
        ...draft,
        id: personId,
        photo,
        attachments: attachments.length > 0 ? attachments : null,
      };

      await replaceAssets(nextAssets);
      const savedSnapshot = upsertPerson(nextPerson);

      if (!savedSnapshot) {
        throw new Error("Lo snapshot dell’archivio non è disponibile.");
      }

      setSelectedPersonId(nextPerson.id);
      setEditorState(null);
    } catch (error) {
      if (previousAssets) {
        await replaceAssets(previousAssets).catch(() => undefined);
      }
      showSaveError(error);
    }
  };


  const handleDeletePerson = async (personId: string) => {
    const person = storedPeopleById.get(personId);
    if (!person) {
      return;
    }

    const confirmed = window.confirm(
      `Eliminare “${getPersonDisplayName(person)}”? La persona e tutti i suoi contenuti multimediali saranno eliminati definitivamente.`,
    );
    if (!confirmed) {
      return;
    }

    const previousAssets = await refreshAssets();
    const nextAssets = previousAssets.filter(
      (asset) => asset.personId !== personId,
    );

    try {
      await replaceAssets(nextAssets);
      const savedSnapshot = deletePerson(personId);
      if (!savedSnapshot) {
        throw new Error("Lo snapshot dell’archivio non è disponibile.");
      }

      setSelectedPersonId(null);
      setEditorState(null);
    } catch (error) {
      await replaceAssets(previousAssets).catch(() => undefined);
      showSaveError(error);
    }
  };

  const handleExportArchive = async () => {
    const referencedAssetIds = snapshot.people.flatMap(
      getPersonMediaAssetIds,
    );
    const currentAssets = await ensureDemoAssets(referencedAssetIds);
    const archiveBlob = await exportAlberoPackage(snapshot, currentAssets);
    const downloadUrl = URL.createObjectURL(archiveBlob);
    const link = document.createElement("a");

    link.download = createArchiveFileName(
      snapshot.metadata.familyName,
    );
    link.href = downloadUrl;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 60_000);
  };

  const handleImportArchive = async (file: File) => {
    const imported = await importAlberoPackage(file);
    const confirmed = window.confirm(
      `Importare “${file.name}”? L’archivio corrente sarà sostituito con ${imported.snapshot.people.length} persone e ${imported.assets.length} file multimediali.`,
    );

    if (!confirmed) {
      return false;
    }

    const previousSnapshot = snapshot;
    const previousAssets = await refreshAssets();

    try {
      await replaceAssets(imported.assets);
      replaceSnapshot(
        removeLegacyAttachmentValues(imported.snapshot),
      );
      markDemoMediaMigrationComplete();
      didMigrateDemoMediaRef.current = true;
    } catch (error) {
      await replaceAssets(previousAssets).catch(() => undefined);
      try {
        replaceSnapshot(previousSnapshot);
      } catch {
        // Preserve the original import error after the best-effort rollback.
      }
      throw error;
    }

    setQuery("");
    setSelectedPersonId(null);
    setEditorState(null);
    return true;
  };

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
        {isAdmin && persistenceStatus === "volatile" ? (
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

        {warnings.length > 0 ? (
          <aside aria-live="polite" className="family-tree-warnings">
            <strong>Controlli di coerenza</strong>
            <div>
              {warnings.map((warning) => (
                <span key={warning}>{warning}</span>
              ))}
            </div>
          </aside>
        ) : null}

        {view === "diagram" ? (
          <TreeDiagramView
            onSelectPerson={handleSelectPerson}
            people={displayPeople}
            query={deferredQuery}
            selectedPersonId={selectedPersonId}
          />
        ) : null}
        {view === "table" ? (
          <PeopleTable
            onSelectPerson={handleSelectPerson}
            people={displayPeople}
            query={query}
          />
        ) : null}
        {view === "timeline" ? (
          <TimelineView
            onSelectPerson={handleSelectPerson}
            people={displayPeople}
            query={deferredQuery}
          />
        ) : null}
      </section>

      {isPersonModalOpen ? (
        <PersonModal
          media={selectedMedia}
          onClose={() => setSelectedPersonId(null)}
          onEdit={
            isAdmin && selectedPerson ? handleEditPerson : undefined
          }
          peopleById={peopleById}
          person={selectedPerson}
        />
      ) : null}
      {isEditorOpen ? (
        <PersonEditorModal
          existingMedia={editorMedia}
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
