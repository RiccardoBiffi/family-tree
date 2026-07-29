import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { seedFamilyTree } from "@/data/seedFamilyTree";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import {
  FAMILY_TREE_STORAGE_KEY,
  FAMILY_TREE_VERSION,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";

function findPerson(snapshot: FamilyTreeSnapshot, personId: string) {
  const person = snapshot.people.find((candidate) => candidate.id === personId);
  expect(person, `Expected person ${personId} to exist`).toBeDefined();
  return person!;
}

describe("useFamilyTreeStore relationship persistence", () => {
  it("retains every editable field and replaces reciprocal relationships after reload", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const originalSnapshot = result.current.snapshot!;
    const originalPerson = findPerson(originalSnapshot, "p3");
    let savedSnapshot: FamilyTreeSnapshot | null = null;

    act(() => {
      savedSnapshot = result.current.upsertPerson({
        ...originalPerson,
        name: "Marco aggiornato",
        knownAs: "Arco",
        surname: "Nuovo",
        sex: "nonbinary",
        birthDate: "1969-02-03",
        birthPlace: "Torino",
        deathDate: "2025-04-05",
        deathPlace: "Genova",
        photo: "https://example.com/marco.jpg",
        distinguishingMarks: "Cicatrice sul mento",
        attachments: ["documento.pdf", "intervista.mp3"],
        notes: "Note biografiche aggiornate",
        profession: "Urbanista",
        instruction: "Laurea in architettura",
        tags: ["archivio", "famiglia"],
        parentIds: ["p6"],
        childIds: ["p9"],
        partnerIds: ["p4"],
      });
    });

    expect(savedSnapshot).not.toBeNull();

    const reloaded = new LocalStorageDB().load();
    const editedPerson = findPerson(reloaded, "p3");

    expect(reloaded.version).toBe(FAMILY_TREE_VERSION);
    expect(editedPerson).toMatchObject({
      id: "p3",
      name: "Marco aggiornato",
      knownAs: "Arco",
      surname: "Nuovo",
      sex: "nonbinary",
      birthDate: "1969-02-03",
      birthPlace: "Torino",
      deathDate: "2025-04-05",
      deathPlace: "Genova",
      photo: "https://example.com/marco.jpg",
      distinguishingMarks: "Cicatrice sul mento",
      attachments: ["documento.pdf", "intervista.mp3"],
      notes: "Note biografiche aggiornate",
      profession: "Urbanista",
      instruction: "Laurea in architettura",
      tags: ["archivio", "famiglia"],
      parentIds: ["p6"],
      childIds: ["p9"],
      partnerIds: ["p4"],
      createdAt: originalPerson.createdAt,
    });

    expect(findPerson(reloaded, "p1").childIds).not.toContain("p3");
    expect(findPerson(reloaded, "p2").childIds).not.toContain("p3");
    expect(findPerson(reloaded, "p6").childIds).toContain("p3");

    expect(findPerson(reloaded, "p7").parentIds).not.toContain("p3");
    expect(findPerson(reloaded, "p8").parentIds).not.toContain("p3");
    expect(findPerson(reloaded, "p9").parentIds).toContain("p3");

    expect(findPerson(reloaded, "p5").partnerIds).not.toContain("p3");
    expect(findPerson(reloaded, "p4").partnerIds).toContain("p3");

    const stored = JSON.parse(
      window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
    ) as FamilyTreeSnapshot | null;
    expect(stored?.version).toBe(FAMILY_TREE_VERSION);
  });

  it("persists removing every parent, child, and partner with reciprocal edges cleared", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());

    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    const originalPerson = findPerson(result.current.snapshot!, "p8");

    act(() => {
      result.current.upsertPerson({
        ...originalPerson,
        parentIds: [],
        childIds: [],
        partnerIds: [],
      });
    });

    const reloaded = new LocalStorageDB().load();
    const editedPerson = findPerson(reloaded, "p8");

    expect(editedPerson.parentIds).toEqual([]);
    expect(editedPerson.childIds).toEqual([]);
    expect(editedPerson.partnerIds).toEqual([]);
    expect(findPerson(reloaded, "p3").childIds).not.toContain("p8");
    expect(findPerson(reloaded, "p5").childIds).not.toContain("p8");
    expect(findPerson(reloaded, "p10").parentIds).not.toContain("p8");
    expect(findPerson(reloaded, "p9").partnerIds).not.toContain("p8");
  });
});
