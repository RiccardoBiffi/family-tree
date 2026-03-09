import { seedFamilyTree } from "@/data/seedFamilyTree";
import {
  FAMILY_TREE_STORAGE_KEY,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";
import { normalizeFamilyTree } from "@/utils/familyTree";

export class LocalStorageDB {
  readonly storageKey: string;

  constructor(storageKey = FAMILY_TREE_STORAGE_KEY) {
    this.storageKey = storageKey;
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
  }

  load(): FamilyTreeSnapshot {
    if (!this.isAvailable()) {
      return normalizeFamilyTree(seedFamilyTree);
    }

    const storedValue = window.localStorage.getItem(this.storageKey);

    if (!storedValue) {
      const seeded = normalizeFamilyTree(seedFamilyTree);
      this.save(seeded);
      return seeded;
    }

    try {
      return normalizeFamilyTree(JSON.parse(storedValue) as FamilyTreeSnapshot);
    } catch {
      const seeded = normalizeFamilyTree(seedFamilyTree);
      this.save(seeded);
      return seeded;
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
