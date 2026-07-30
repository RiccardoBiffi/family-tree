"use client";

import { useEffect, useRef, useState } from "react";

import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import type { PersonRecord } from "@/models/Person";
import {
  normalizeFamilyTree,
  reconcilePersonRelationships,
} from "@/utils/familyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";
import type { PersistenceStatus } from "@/utils/persistence";

export function useFamilyTreeStore() {
  const dbRef = useRef<LocalStorageDB | null>(null);
  const [snapshot, setSnapshot] = useState<FamilyTreeSnapshot | null>(null);
  const [needsArchiveSetup, setNeedsArchiveSetup] = useState(false);
  const [persistenceStatus, setPersistenceStatus] =
    useState<PersistenceStatus>("durable");

  if (!dbRef.current) {
    dbRef.current = new LocalStorageDB();
  }

  useEffect(() => {
    const loaded = dbRef.current?.loadWithStatus();
    setSnapshot(loaded?.snapshot ?? null);
    setNeedsArchiveSetup(loaded?.status === "missing");
    setPersistenceStatus(loaded?.persistenceStatus ?? "volatile");
  }, []);

  const persistSnapshot = (nextSnapshot: FamilyTreeSnapshot) => {
    const saved = dbRef.current?.save(nextSnapshot) ?? normalizeFamilyTree(nextSnapshot);
    setPersistenceStatus(
      dbRef.current?.getPersistenceStatus() ?? "volatile",
    );
    setSnapshot(saved);
    return saved;
  };

  const upsertPerson = (draft: PersonRecord) => {
    if (!snapshot) {
      return null;
    }

    const existingPerson = snapshot.people.find((person) => person.id === draft.id);
    const nextPerson: PersonRecord = {
      ...draft,
      createdAt: existingPerson?.createdAt ?? draft.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const people = reconcilePersonRelationships(snapshot.people, nextPerson);

    return persistSnapshot({
      ...snapshot,
      people,
    });
  };

  const deletePerson = (personId: string) => {
    if (!snapshot) {
      return null;
    }

    return persistSnapshot({
      ...snapshot,
      people: snapshot.people.filter((person) => person.id !== personId),
    });
  };

  const initializeArchive = (familyName: string) => {
    const normalizedFamilyName = familyName.trim();

    if (!snapshot || !needsArchiveSetup || !normalizedFamilyName) {
      return null;
    }

    const saved = persistSnapshot({
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        title: `Archivio della famiglia ${normalizedFamilyName}`,
        familyName: normalizedFamilyName,
      },
    });
    setNeedsArchiveSetup(false);
    return saved;
  };

  const replaceSnapshot = (nextSnapshot: FamilyTreeSnapshot) => {
    const saved = persistSnapshot(nextSnapshot);
    setNeedsArchiveSetup(false);
    return saved;
  };
  const resetDemoData = () => {
    const seeded = dbRef.current?.reset() ?? null;
    setPersistenceStatus(
      dbRef.current?.getPersistenceStatus() ?? "volatile",
    );
    setSnapshot(seeded);
    setNeedsArchiveSetup(false);
    return seeded;
  };

  return {
    snapshot,
    isLoaded: snapshot !== null,
    persistenceStatus,
    needsArchiveSetup,
    initializeArchive,
    replaceSnapshot,
    upsertPerson,
    deletePerson,
    resetDemoData,
  };
}
