import { describe, expect, it } from "vitest";

import { seedFamilyTree } from "@/data/seedFamilyTree";
import { FAMILY_TREE_VERSION } from "@/models/FamilyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";

describe("LocalStorageDB", () => {
  it("reports an absent snapshot as data-less without persisting demo records", () => {
    const db = new LocalStorageDB("family-tree.test.load");

    const loaded = db.loadWithStatus();

    expect(loaded.status).toBe("missing");
    expect(loaded.snapshot.version).toBe(FAMILY_TREE_VERSION);
    expect(loaded.snapshot.metadata.familyName).toBe("");
    expect(loaded.snapshot.people).toEqual([]);
    expect(window.localStorage.getItem("family-tree.test.load")).toBeNull();
  });

  it("loads an existing v1 snapshot without treating an empty people list as first run", () => {
    const storageKey = "family-tree.test.backcompat";
    const db = new LocalStorageDB(storageKey);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...seedFamilyTree,
        people: [],
      }),
    );

    const loaded = db.loadWithStatus();

    expect(loaded.status).toBe("stored");
    expect(loaded.snapshot.version).toBe(FAMILY_TREE_VERSION);
    expect(loaded.snapshot.metadata.familyName).toBe("Rinaldi");
    expect(loaded.snapshot.people).toEqual([]);
  });

  it("keeps malformed-payload recovery on the demo archive", () => {
    const storageKey = "family-tree.test.recovery";
    const db = new LocalStorageDB(storageKey);
    window.localStorage.setItem(storageKey, "{not-json");

    const loaded = db.loadWithStatus();

    expect(loaded.status).toBe("demo-fallback");
    expect(loaded.snapshot.metadata.familyName).toBe("Rinaldi");
    expect(loaded.snapshot.people.length).toBeGreaterThan(0);
    expect(window.localStorage.getItem(storageKey)).toContain("Giovanni");
  });

  it("still restores and persists the explicit demo archive", () => {
    const storageKey = "family-tree.test.reset";
    const db = new LocalStorageDB(storageKey);

    const snapshot = db.reset();

    expect(snapshot.metadata.familyName).toBe("Rinaldi");
    expect(snapshot.people.length).toBe(seedFamilyTree.people.length);
    expect(window.localStorage.getItem(storageKey)).toContain("Giovanni");
  });

  it("normalizes parent-child and partner references before saving", () => {
    const db = new LocalStorageDB("family-tree.test.normalize");

    const saved = db.save({
      version: FAMILY_TREE_VERSION,
      metadata: {
        title: "Test",
        description: "Snapshot di prova",
        familyName: "Test",
        updatedAt: "2026-03-09T00:00:00.000Z",
      },
      people: [
        {
          id: "p1",
          name: "Mario",
          knownAs: null,
          surname: "Rossi",
          sex: "male",
          birthDate: "1980-01-01",
          birthPlace: null,
          deathDate: null,
          deathPlace: null,
          photo: null,
          distinguishingMarks: null,
          attachments: null,
          notes: null,
          profession: null,
          instruction: null,
          tags: null,
          parentIds: [],
          childIds: ["p2"],
          partnerIds: ["p2"],
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
        {
          id: "p2",
          name: "Giulia",
          knownAs: null,
          surname: "Bianchi",
          sex: "female",
          birthDate: "2005-01-01",
          birthPlace: null,
          deathDate: null,
          deathPlace: null,
          photo: null,
          distinguishingMarks: null,
          attachments: null,
          notes: null,
          profession: null,
          instruction: null,
          tags: null,
          parentIds: [],
          childIds: [],
          partnerIds: [],
          createdAt: "2026-03-09T00:00:00.000Z",
          updatedAt: "2026-03-09T00:00:00.000Z",
        },
      ],
    });

    const mario = saved.people.find((person) => person.id === "p1");
    const giulia = saved.people.find((person) => person.id === "p2");

    expect(mario?.childIds).toContain("p2");
    expect(mario?.partnerIds).toContain("p2");
    expect(giulia?.parentIds).toContain("p1");
    expect(giulia?.partnerIds).toContain("p1");
  });
});
