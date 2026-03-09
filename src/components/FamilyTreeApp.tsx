"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";

import { AdminPanel } from "@/components/AdminPanel";
import { PeopleTable } from "@/components/PeopleTable";
import { PersonEditorModal } from "@/components/PersonEditorModal";
import { PersonModal } from "@/components/PersonModal";
import { TimelineView } from "@/components/TimelineView";
import { TreeDiagramView } from "@/components/TreeDiagramView";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import type { PersonRecord } from "@/models/Person";
import {
  createEmptyPersonDraft,
  createPersonId,
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

const viewLabels: Record<AppView, { title: string; subtitle: string }> = {
  diagram: {
    title: "Diagramma",
    subtitle: "Navigazione libera con zoom, panning e dettagli contestuali.",
  },
  table: {
    title: "Tabella",
    subtitle: "Ordinamento rapido, filtri testuali e colonne personalizzabili.",
  },
  timeline: {
    title: "Timeline",
    subtitle: "La stessa famiglia disposta lungo una linea temporale interattiva.",
  },
};
const emptyPeople: PersonRecord[] = [];

export function FamilyTreeApp() {
  const { snapshot, isLoaded, upsertPerson, deletePerson, resetDemoData } = useFamilyTreeStore();
  const [mode, setMode] = useState<AppMode>("visitor");
  const [view, setView] = useState<AppView>("diagram");
  const [query, setQuery] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const deferredQuery = useDeferredValue(query);
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
  const activeAdminPersonId = useMemo(() => {
    if (editorState?.mode === "edit") {
      return editorState.personId;
    }

    return selectedPersonId;
  }, [editorState, selectedPersonId]);
  const isEditorOpen = mode === "admin" && editorState !== null && editorPerson !== null;
  const isPersonModalOpen = selectedPerson !== null && !isEditorOpen;
  const warnings = useMemo(() => (snapshot ? validateFamilyTree(snapshot) : []), [snapshot]);
  const totalFamilies = useMemo(
    () =>
      new Set(
        people.flatMap((person) =>
          person.partnerIds.map((partnerId) => [person.id, partnerId].sort().join("--")),
        ),
      ).size,
    [people],
  );

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
    if (mode !== "admin" && editorState) {
      setEditorState(null);
    }
  }, [editorState, mode]);

  if (!isLoaded || !snapshot) {
    return (
      <main className="min-h-screen bg-[linear-gradient(180deg,#f6efdf_0%,#efe2c8_100%)] px-4 py-10 text-slate-900">
        <div className="mx-auto max-w-7xl rounded-[36px] border border-[#d9cfbd] bg-white/70 px-8 py-16 text-center shadow-[0_30px_120px_rgba(15,23,42,0.08)] backdrop-blur">
          <p className="text-xs uppercase tracking-[0.34em] text-[#5f6d63]">Family tree</p>
          <h1 className="mt-4 font-[family-name:var(--font-display)] text-5xl leading-none text-slate-900">
            Sto preparando l&apos;archivio genealogico
          </h1>
        </div>
      </main>
    );
  }

  const handleSelectPerson = (personId: string) => {
    setEditorState(null);
    setSelectedPersonId(personId);
  };

  const handleCreatePerson = () => {
    setMode("admin");
    setSelectedPersonId(null);
    setEditorState({
      mode: "create",
      draft: createEmptyPersonDraft(),
    });
  };

  const handleEditPerson = (personId: string) => {
    setMode("admin");
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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6efdf_0%,#efe2c8_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="overflow-hidden rounded-[36px] border border-[#d9cfbd] bg-[linear-gradient(140deg,#fcfaf4_0%,#f3e9d4_46%,#dfc287_100%)] shadow-[0_30px_120px_rgba(15,23,42,0.08)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.6fr_0.9fr] lg:px-8">
            <div>
              <p className="text-xs uppercase tracking-[0.34em] text-[#5f6d63]">
                Archivio locale senza server
              </p>
              <h1 className="mt-4 max-w-3xl font-[family-name:var(--font-display)] text-5xl leading-none text-[#132718] sm:text-6xl">
                {snapshot.metadata.title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">
                {snapshot.metadata.description}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
                  {snapshot.people.length} persone archiviate
                </span>
                <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
                  {totalFamilies} relazioni di coppia
                </span>
                <span className="rounded-full bg-white/90 px-4 py-2 text-sm font-medium text-slate-700">
                  Ultimo aggiornamento {new Date(snapshot.metadata.updatedAt).toLocaleDateString("it-IT")}
                </span>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/60 bg-white/75 p-5 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Ruolo</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">Accesso locale</h2>
                </div>
                <div className="rounded-full bg-[#f4ecd9] p-1">
                  {(["visitor", "admin"] as AppMode[]).map((currentMode) => (
                    <button
                      className={[
                        "rounded-full px-4 py-2 text-sm font-medium transition",
                        mode === currentMode
                          ? "bg-[#153524] text-white"
                          : "text-slate-600 hover:text-[#153524]",
                      ].join(" ")}
                      key={currentMode}
                      onClick={() => setMode(currentMode)}
                      type="button"
                    >
                      {currentMode === "visitor" ? "Visitatore" : "Amministratore"}
                    </button>
                  ))}
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                La modalita&apos; visitatore consente solo la consultazione. La modalita&apos; amministratore abilita l&apos;editor e resta disponibile solo nel browser corrente.
              </p>

              <label className="mt-5 block space-y-2">
                <span className="text-xs uppercase tracking-[0.18em] text-slate-500">Ricerca trasversale</span>
                <input
                  className="w-full rounded-2xl border border-[#d9cfbd] bg-[#fffaf1] px-4 py-3 text-sm outline-none transition focus:border-[#5f8f63] focus:ring-4 focus:ring-[#5f8f63]/10"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cerca per nome, tag, luogo o professione"
                  value={query}
                />
              </label>
            </div>
          </div>
        </section>

        {warnings.length > 0 ? (
          <section className="rounded-[28px] border border-[#e0c28f] bg-[#fff8eb] px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.05)]">
            <p className="text-xs uppercase tracking-[0.24em] text-[#9b6a1d]">Controlli di coerenza</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {warnings.map((warning) => (
                <span
                  className="rounded-full border border-[#f0d7ad] bg-white px-3 py-2 text-sm text-[#805821]"
                  key={warning}
                >
                  {warning}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[#d9cfbd] bg-[#f8f1e4] px-5 py-5 shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-[#5f6d63]">Visualizzazioni</p>
              <h2 className="font-[family-name:var(--font-display)] text-3xl text-slate-900">
                Scegli il modo di leggere la famiglia
              </h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {(Object.keys(viewLabels) as AppView[]).map((currentView) => (
                <button
                  className={[
                    "rounded-[24px] border px-4 py-4 text-left transition",
                    view === currentView
                      ? "border-[#5f8f63] bg-white text-[#153524] shadow-sm"
                      : "border-[#d9cfbd] bg-white/60 text-slate-700 hover:border-[#5f8f63]",
                  ].join(" ")}
                  key={currentView}
                  onClick={() => setView(currentView)}
                  type="button"
                >
                  <span className="block text-sm font-semibold">{viewLabels[currentView].title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {viewLabels[currentView].subtitle}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={mode === "admin" ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]" : "space-y-6"}>
          <div className="space-y-6">
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
          </div>

          {mode === "admin" ? (
            <AdminPanel
              onCreatePerson={handleCreatePerson}
              onResetDemoData={handleResetDemo}
              onOpenPerson={handleSelectPerson}
              people={snapshot.people}
              selectedPersonId={activeAdminPersonId}
            />
          ) : null}
        </div>
      </div>

      {isPersonModalOpen ? (
        <PersonModal
          onClose={() => setSelectedPersonId(null)}
          onEdit={mode === "admin" && selectedPerson ? handleEditPerson : undefined}
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
