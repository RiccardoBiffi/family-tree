import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { seedFamilyTree } from "@/data/seedFamilyTree";
import { useFamilyTreeStore } from "@/hooks/useFamilyTreeStore";
import {
  FAMILY_TREE_STORAGE_KEY,
  FAMILY_TREE_VERSION,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { getBiologicalParentIds, getDiagramParentIds, getFamilyTreeIssues } from "@/utils/familyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";
import { mockArchiveDB } from "@/test/mockArchiveDB";
import { createMediaAssetRecord } from "@/models/MediaAsset";
import { ArchiveConflictError } from "@/utils/mediaDB";

function findPerson(snapshot: FamilyTreeSnapshot, personId: string) {
  const person = snapshot.people.find((candidate) => candidate.id === personId);
  expect(person, `Expected person ${personId} to exist`).toBeDefined();
  return person!;
}

describe("useFamilyTreeStore relationship persistence", () => {
  let database: ReturnType<typeof mockArchiveDB>;
  beforeEach(() => { database = mockArchiveDB(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it("retains every editable field and replaces reciprocal relationships after reload", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    const originalSnapshot = result.current.snapshot!;
    const originalPerson = findPerson(originalSnapshot, "p3");
    await act(async () => {
      expect(await result.current.upsertPerson({
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
        childIds: ["p2"],
        partnerIds: ["p4"],
      })).toBe(true);
    });

    const { result: reopened } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(reopened.current.snapshot).not.toBeNull());
    const reloaded = reopened.current.snapshot!;
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
      childIds: ["p2"],
      partnerIds: ["p4"],
      createdAt: originalPerson.createdAt,
    });

    expect(findPerson(reloaded, "p1").childIds).not.toContain("p3");
    expect(findPerson(reloaded, "p2").childIds).not.toContain("p3");
    expect(findPerson(reloaded, "p6").childIds).toContain("p3");

    expect(findPerson(reloaded, "p7").parentIds).not.toContain("p3");
    expect(findPerson(reloaded, "p8").parentIds).not.toContain("p3");
    expect(findPerson(reloaded, "p2").parentIds).toContain("p3");

    expect(findPerson(reloaded, "p5").partnerIds).not.toContain("p3");
    expect(findPerson(reloaded, "p4").partnerIds).toContain("p3");

    const stored = JSON.parse(
      window.localStorage.getItem(FAMILY_TREE_STORAGE_KEY) ?? "null",
    ) as FamilyTreeSnapshot | null;
    expect(stored?.version).toBe(FAMILY_TREE_VERSION);
    expect(findPerson(stored!, "p3").name).toBe(originalPerson.name);
    expect(database.commit).toHaveBeenCalledTimes(2);
  });

  it("adds a third parent through a reciprocal edit and keeps the selected parents through reload", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    const existing = findPerson(result.current.snapshot!, "p3");
    const addedParent = findPerson(result.current.snapshot!, "p6");
    await act(async () => {
      await expect(result.current.upsertPerson({
        ...addedParent,
        childIds: [...addedParent.childIds, existing.id],
      })).resolves.toBe(true);
    });

    const child = findPerson(result.current.snapshot!, "p3");
    expect(child.parentIds).toEqual(["p1", "p2", "p6"]);
    expect(getBiologicalParentIds(child)).toEqual(["p1", "p2"]);
    expect(getDiagramParentIds(child)).toEqual([]);
    expect(getFamilyTreeIssues(result.current.snapshot!)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "diagram-parents", personIds: ["p3"] })]),
    );

    await act(async () => {
      await expect(result.current.upsertPerson({
        ...child,
        biologicalParentIds: ["p2"],
        diagramParentIds: ["p2", "p6"],
      })).resolves.toBe(true);
    });

    const { result: reopened } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(reopened.current.snapshot).not.toBeNull());
    const reloadedChild = findPerson(reopened.current.snapshot!, "p3");
    expect(getBiologicalParentIds(reloadedChild)).toEqual(["p2"]);
    expect(getDiagramParentIds(reloadedChild)).toEqual(["p2", "p6"]);
    expect(getFamilyTreeIssues(reopened.current.snapshot!).map(({ id }) => id)).not.toContain("diagram-parents");
  });

  it("persists replacing and deleting explicitly recorded siblings in both directions", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    const person = findPerson(result.current.snapshot!, "p2");
    await act(async () => {
      await result.current.upsertPerson({ ...person, siblingIds: ["p6"] });
    });
    expect(findPerson(result.current.snapshot!, "p6").siblingIds).toEqual(["p2"]);
    await act(async () => {
      await result.current.upsertPerson({ ...person, siblingIds: ["p5"] });
    });
    const { result: reopened } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(reopened.current.snapshot).not.toBeNull());
    const reloaded = reopened.current.snapshot!;
    expect(findPerson(reloaded, "p2").siblingIds).toEqual(["p5"]);
    expect(findPerson(reloaded, "p5").siblingIds).toEqual(["p2"]);
    expect(findPerson(reloaded, "p6").siblingIds).toBeUndefined();
    expect(findPerson(reloaded, "p2").parentIds).toEqual(person.parentIds);
    await act(async () => { await reopened.current.deletePerson("p5"); });
    expect(findPerson(database.snapshot!, "p2").siblingIds).toBeUndefined();
  });

  it("removes an obsolete diagram choice when the corresponding parent deletes the child link", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    const child = findPerson(result.current.snapshot!, "p3");
    await act(async () => {
      await result.current.upsertPerson({
        ...child,
        parentIds: ["p1", "p2", "p5", "p6"],
        biologicalParentIds: ["p2", "p6"],
        diagramParentIds: ["p1", "p6"],
      });
    });
    const parent = findPerson(result.current.snapshot!, "p6");
    await act(async () => {
      await result.current.upsertPerson({ ...parent, childIds: parent.childIds.filter((id) => id !== child.id) });
    });
    const updated = findPerson(result.current.snapshot!, child.id);
    expect(updated.parentIds).toEqual(["p1", "p2", "p5"]);
    expect(updated.biologicalParentIds).toEqual(["p2"]);
    expect(updated.diagramParentIds).toEqual(["p1"]);
    expect(getDiagramParentIds(updated)).toEqual([]);
  });

  it("persists removing every parent, child, and partner with reciprocal edges cleared", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result } = renderHook(() => useFamilyTreeStore());

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());

    const originalPerson = findPerson(result.current.snapshot!, "p8");

    await act(async () => {
      await result.current.upsertPerson({
        ...originalPerson,
        parentIds: [],
        childIds: [],
        partnerIds: [],
      });
    });

    const { result: reopened } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(reopened.current.snapshot).not.toBeNull());
    const reloaded = reopened.current.snapshot!;
    const editedPerson = findPerson(reloaded, "p8");

    expect(editedPerson.parentIds).toEqual([]);
    expect(editedPerson.childIds).toEqual([]);
    expect(editedPerson.partnerIds).toEqual([]);
    expect(findPerson(reloaded, "p3").childIds).not.toContain("p8");
    expect(findPerson(reloaded, "p5").childIds).not.toContain("p8");
    expect(findPerson(reloaded, "p10").parentIds).not.toContain("p8");
    expect(findPerson(reloaded, "p9").partnerIds).not.toContain("p8");
  });

  it("exposes volatile status while keeping archive edits usable in memory", async () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Access denied.", "SecurityError");
      });
    const { result } = renderHook(() => useFamilyTreeStore());

    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    expect(result.current.isVolatile).toBe(true);
    expect(result.current.needsArchiveSetup).toBe(true);

    await act(async () => {
      await result.current.initializeArchive("Volatile");
    });
    expect(result.current.snapshot?.metadata.familyName).toBe("Volatile");

    const person = seedFamilyTree.people[0];
    await act(async () => {
      await result.current.upsertPerson({
        ...person,
        id: "volatile-person",
        parentIds: [],
        childIds: [],
        partnerIds: [],
      });
    });

    expect(result.current.snapshot?.people).toHaveLength(4);
    expect(result.current.snapshot?.people.some(({ id }) => id === "volatile-person")).toBe(true);
    expect(result.current.isVolatile).toBe(true);

    getItem.mockRestore();
    new LocalStorageDB().clear();
  });

  it("preserves the original archive when quota is exhausted and exports the whole session", async () => {
    const photo = createMediaAssetRecord({
      id: "first", personId: "p1", name: "first.png", role: "photo",
      blob: new Blob(["first"], { type: "image/png" }),
    });
    database.assets.set(photo.id, photo);
    const person = { ...seedFamilyTree.people[0], photo: "media:first" };
    new LocalStorageDB().save({ ...seedFamilyTree, people: [person] });
    const { result } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(result.current.snapshot).not.toBeNull());
    const replacement = createMediaAssetRecord({
      id: "second", personId: "p1", name: "second.png", role: "photo",
      blob: new Blob(["second"], { type: "image/png" }),
    });
    database.commit.mockRejectedValueOnce(new DOMException("Quota", "QuotaExceededError"));
    await act(async () => {
      await result.current.upsertPerson(
        { ...person, photo: "media:second" },
        { put: [replacement], remove: [photo.id] },
      );
    });
    expect(result.current.isVolatile).toBe(true);
    expect(database.snapshot?.people[0].photo).toBe("media:first");
    expect([...database.assets.values()]).toEqual([photo]);
    expect(await result.current.readForExport()).toMatchObject({
      snapshot: { people: [{ photo: "media:second" }] },
      assets: [replacement],
    });
  });

  it("rejects stale and duplicate mutations", async () => {
    new LocalStorageDB().save(seedFamilyTree);
    const { result: first } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(first.current.snapshot).not.toBeNull());
    const { result: second } = renderHook(() => useFamilyTreeStore());
    await waitFor(() => expect(second.current.snapshot).not.toBeNull());
    const person = seedFamilyTree.people[0];
    await act(async () => {
      const pending = first.current.upsertPerson({ ...person, name: "La prima modifica" });
      expect(await first.current.upsertPerson({ ...person, name: "Doppio invio" })).toBe(false);
      expect(await pending).toBe(true);
      await expect(second.current.upsertPerson({ ...person, name: "Scheda obsoleta" }))
        .rejects.toBeInstanceOf(ArchiveConflictError);
    });
    expect(database.snapshot?.people.find(({ id }) => id === person.id)?.name).toBe("La prima modifica");
    expect(second.current.isVolatile).toBe(false);
  });
});
