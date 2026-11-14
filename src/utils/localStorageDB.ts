import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  FAMILY_TREE_STORAGE_KEY,
  FAMILY_TREE_VERSION,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { normalizeFamilyTree } from "@/utils/familyTree";
import {
  isPersistenceCapabilityError,
  type PersistenceStatus,
} from "@/utils/persistence";

export interface FamilyTreeLoadResult {
  snapshot: FamilyTreeSnapshot;
  status: "missing" | "stored" | "demo-fallback";
  persistenceStatus: PersistenceStatus;
}

const volatileSnapshots = new Map<string, string>();

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

  private persistenceStatus: PersistenceStatus = "durable";

  constructor(storageKey = FAMILY_TREE_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  private getStorage(): Storage | null {
    if (this.persistenceStatus === "volatile") {
      return null;
    }

    if (typeof window === "undefined") {
      this.persistenceStatus = "volatile";
      return null;
    }

    try {
      return window.localStorage;
    } catch (error) {
      if (!isPersistenceCapabilityError(error)) {
        throw error;
      }

      this.persistenceStatus = "volatile";
      return null;
    }
  }

  getPersistenceStatus(): PersistenceStatus {
    this.getStorage();
    return this.persistenceStatus;
  }

  isAvailable(): boolean {
    return this.getStorage() !== null;
  }

  load(): FamilyTreeSnapshot {
    return this.loadWithStatus().snapshot;
  }

  loadWithStatus({ repair = true } = {}): FamilyTreeLoadResult {
    const storage = this.getStorage();
    let storedValue: string | null;

    if (!storage) {
      storedValue = volatileSnapshots.get(this.storageKey) ?? null;
    } else {
      try {
        storedValue = storage.getItem(this.storageKey);
      } catch (error) {
        if (!isPersistenceCapabilityError(error)) {
          throw error;
        }

        this.persistenceStatus = "volatile";
        storedValue = volatileSnapshots.get(this.storageKey) ?? null;
      }
    }

    if (storedValue === null) {
      return {
        snapshot: createUninitializedArchive(),
        status: "missing",
        persistenceStatus: this.persistenceStatus,
      };
    }

    try {
      return {
        snapshot: normalizeFamilyTree(JSON.parse(storedValue) as FamilyTreeSnapshot),
        status: "stored",
        persistenceStatus: this.persistenceStatus,
      };
    } catch {
      const seeded = normalizeFamilyTree(seedFamilyTree);
      if (repair) {
        this.save(seeded);
      }
      return {
        snapshot: seeded,
        status: "demo-fallback",
        persistenceStatus: this.persistenceStatus,
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

    const serialized = JSON.stringify(normalized);
    const storage = this.getStorage();

    if (!storage) {
      volatileSnapshots.set(this.storageKey, serialized);
      return normalized;
    }

    try {
      storage.setItem(this.storageKey, serialized);
    } catch (error) {
      if (!isPersistenceCapabilityError(error)) {
        throw error;
      }

      this.persistenceStatus = "volatile";
      volatileSnapshots.set(this.storageKey, serialized);
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
    volatileSnapshots.delete(this.storageKey);
    const storage = this.getStorage();

    if (!storage) {
      return;
    }

    try {
      storage.removeItem(this.storageKey);
    } catch (error) {
      if (!isPersistenceCapabilityError(error)) {
        throw error;
      }

      this.persistenceStatus = "volatile";
    }
  }
}
