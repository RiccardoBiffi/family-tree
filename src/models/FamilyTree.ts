import type { PersonRecord } from "@/models/Person";

export const FAMILY_TREE_STORAGE_KEY = "family-tree.snapshot.v1";
export const FAMILY_TREE_VERSION = 1;

export interface FamilyTreeMetadata {
  title: string;
  description: string;
  familyName: string;
  updatedAt: string;
}

export interface FamilyTreeSnapshot {
  version: number;
  metadata: FamilyTreeMetadata;
  people: PersonRecord[];
}
