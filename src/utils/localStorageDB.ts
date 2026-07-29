import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  FAMILY_TREE_STORAGE_KEY,
  FAMILY_TREE_VERSION,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { normalizeFamilyTree } from "@/utils/familyTree";

export interface FamilyTreeLoadResult {
  snapshot: FamilyTreeSnapshot;
  status: "missing" | "stored" | "demo-fallback";
}

function createUninitializedArchive(): FamilyTreeSnapshot {
  return {
    version: FAMILY_TREE_VERSION,
    metadata: {
      title: "Archivio di famiglia",
      description:
        "Un archivio familiare privato salvato esclusivamente in questo browser.",
      familyName: "",
      updatedAt: new Date().toISOString(),
    },
    people: [],
  };
}

export class LocalStorageDB {
  readonly storageKey: string;

  constructor(storageKey = FAMILY_TREE_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  load(): FamilyTreeSnapshot {
    return this.loadWithStatus().snapshot;
  }

  loadWithStatus(): FamilyTreeLoadResult {
    if (!this.isAvailable()) {
      return {
        snapshot: normalizeFamilyTree(seedFamilyTree),
        status: "demo-fallback",
      };
    }

    const storedValue = window.localStorage.getItem(this.storageKey);

    if (storedValue === null) {
      return {
        snapshot: createUninitializedArchive(),
        status: "missing",
      };
    }

    try {
      return {
        snapshot: normalizeFamilyTree(JSON.parse(storedValue) as FamilyTreeSnapshot),
        status: "stored",
      };
    } catch {
      const seeded = normalizeFamilyTree(seedFamilyTree);
      this.save(seeded);
      return {
        snapshot: seeded,
        status: "demo-fallback",
      };
    }
  }

  save(snapshot: FamilyTreeSnapshot): FamilyTreeSnapshot {
    const normalized = normalizeFamilyTree({
      ...snapshot,
      metadata: {
        ...snapshot.metadata,
        updatedAt: new Date().toISOString(),
      },
    });

    if (this.isAvailable()) {
      window.localStorage.setItem(this.storageKey, JSON.stringify(normalized));
    }

    return normalized;
  }

  replace(snapshot: FamilyTreeSnapshot): FamilyTreeSnapshot {
    return this.save(snapshot);
  }

  reset(): FamilyTreeSnapshot {
    return this.save(seedFamilyTree);
  }

  clear(): void {
    if (!this.isAvailable()) {
      return;
    }

    window.localStorage.removeItem(this.storageKey);
  }
}
