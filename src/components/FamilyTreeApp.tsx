"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { ArchiveActions } from "@/components/ArchiveActions";
import { ArchiveIcon } from "@/components/ArchiveIcon";
import { PeopleTable } from "@/components/PeopleTable";
import { PersonEditorModal } from "@/components/PersonEditorModal";
import { PersonModal } from "@/components/PersonModal";
import { TimelineView } from "@/components/TimelineView";
import { TreeDiagramView } from "@/components/TreeDiagramView";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import type { PersonRecord } from "@/models/Person";
import { createEmptyPersonDraft, createPersonId, validateFamilyTree } from "@/utils/familyTree";

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

export function FamilyTreeApp({ mode }: FamilyTreeAppProps) {
  const { snapshot, isLoaded, upsertPerson, deletePerson, resetDemoData } = useFamilyTreeStore();
  const [view, setView] = useState<AppView>("diagram");
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const deferredQuery = useDeferredValue(query);
  const isAdmin = mode === "admin";
  const people = snapshot?.people ?? emptyPeople;
  const peopleById = useMemo(
    () => new Map(people.map((person) => [person.id, person])),
    [people],
  );
  const selectedPerson = useMemo(
    () => (selectedPersonId && snapshot ? peopleById.get(selectedPersonId) ?? null : null),
    [peopleById, selectedPersonId, snapshot],
  );
  const editorPerson = useMemo(() => {
    if (!editorState) {
      return null;
    }

    if (editorState.mode === "create") {
      return editorState.draft;
    }

    return snapshot ? peopleById.get(editorState.personId) ?? null : null;
  }, [editorState, peopleById, snapshot]);
  const warnings = useMemo(() => (snapshot ? validateFamilyTree(snapshot) : []), [snapshot]);
  const isEditorOpen = isAdmin && editorState !== null && editorPerson !== null;
  const isPersonModalOpen = selectedPerson !== null && !isEditorOpen;

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (selectedPersonId && !snapshot.people.some((person) => person.id === selectedPersonId)) {
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

  const handleSavePerson = (draft: PersonRecord) => {
    const nextPerson = {
      ...draft,
      id: draft.id || createPersonId(),
    };
    const savedSnapshot = upsertPerson(nextPerson);

    if (savedSnapshot) {
      setSelectedPersonId(nextPerson.id);
      setEditorState(null);
    }
  };

  const handleDeletePerson = (personId: string) => {
    const savedSnapshot = deletePerson(personId);
    if (savedSnapshot) {
      setSelectedPersonId(null);
      setEditorState(null);
    }
  };

  const handleResetDemo = () => {
    resetDemoData();
    setQuery("");
    setSelectedPersonId(null);
    setEditorState(null);
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
          onQueryChange={setQuery}
          onResetDemoData={handleResetDemo}
          query={query}
        />
        <nav aria-label="Visualizzazioni archivio" className="archive-view-navigation">
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
            people={snapshot.people}
            query={deferredQuery}
          />
        ) : null}
        {view === "table" ? (
          <PeopleTable onSelectPerson={handleSelectPerson} people={snapshot.people} query={query} />
        ) : null}
        {view === "timeline" ? (
          <TimelineView
            onSelectPerson={handleSelectPerson}
            people={snapshot.people}
            query={deferredQuery}
          />
        ) : null}
      </section>

      {isPersonModalOpen ? (
        <PersonModal
          onClose={() => setSelectedPersonId(null)}
          onEdit={isAdmin && selectedPerson ? handleEditPerson : undefined}
          peopleById={peopleById}
          person={selectedPerson}
        />
      ) : null}
      {isEditorOpen ? (
        <PersonEditorModal
          mode={editorState.mode}
          onClose={() => setEditorState(null)}
          onDelete={editorState.mode === "edit" ? handleDeletePerson : undefined}
          onSave={handleSavePerson}
          people={snapshot.people}
          person={editorPerson}
        />
      ) : null}
    </main>
  );
}
