"use client";

import { useEffect, useRef, useState } from "react";

import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import type { PersonRecord } from "@/models/Person";
import { normalizeFamilyTree } from "@/utils/familyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";

export function useFamilyTreeStore() {
  const dbRef = useRef<LocalStorageDB | null>(null);
  const [snapshot, setSnapshot] = useState<FamilyTreeSnapshot | null>(null);

  if (!dbRef.current) {
    dbRef.current = new LocalStorageDB();
  }

  useEffect(() => {
    setSnapshot(dbRef.current?.load() ?? null);
  }, []);

  const persistSnapshot = (nextSnapshot: FamilyTreeSnapshot) => {
    const saved = dbRef.current?.save(nextSnapshot) ?? normalizeFamilyTree(nextSnapshot);
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

    const otherPeople = snapshot.people.filter((person) => person.id !== draft.id);
    const people = draft.id ? [...otherPeople, nextPerson] : [...otherPeople, nextPerson];

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

  const replaceSnapshot = (nextSnapshot: FamilyTreeSnapshot) => persistSnapshot(nextSnapshot);
  const resetDemoData = () => {
    const seeded = dbRef.current?.reset() ?? null;
    setSnapshot(seeded);
    return seeded;
  };

  return {
    snapshot,
    isLoaded: snapshot !== null,
    replaceSnapshot,
    upsertPerson,
    deletePerson,
    resetDemoData,
  };
}
