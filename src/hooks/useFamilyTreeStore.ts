"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import { parseMediaAssetReference, type MediaAssetRecord } from "@/models/MediaAsset";
import { Person, type PersonRecord } from "@/models/Person";
import { normalizeFamilyTree, reconcilePersonRelationships } from "@/utils/familyTree";
import { LocalStorageDB } from "@/utils/localStorageDB";
import { ArchiveConflictError, MediaDB, type ArchiveMediaChanges } from "@/utils/mediaDB";
import { isPersistenceCapabilityError } from "@/utils/persistence";
import { removeLegacyAttachmentValues } from "@/utils/snapshotMigration";

interface ArchiveState {
  snapshot: FamilyTreeSnapshot;
  revision: number | null;
  assetIds: ReadonlySet<string>;
  mediaEpoch: number;
  needsArchiveSetup: boolean;
  sessionAssets: Map<string, MediaAssetRecord> | null;
}

function getReferenceIds(person: PersonRecord): string[] {
  const ids = [];
  const photoId = parseMediaAssetReference(person.photo);
  if (photoId) {
    ids.push(photoId);
  }
  for (const reference of person.attachments ?? []) {
    const id = parseMediaAssetReference(reference);
    if (id) {
      ids.push(id);
    }
  }
  return ids;
}

function getArchiveReferenceIds(snapshot: FamilyTreeSnapshot): string[] {
  return Array.from(new Set(snapshot.people.flatMap(getReferenceIds)));
}

function createExampleFamily(): PersonRecord[] {
  const fatherId = "example-giuseppe-rossi";
  const motherId = "example-maria-bianchi";
  const childId = "example-leonardo-rossi";

  return [
    new Person({
      id: fatherId,
      name: "Giuseppe",
      surname: "Rossi",
      sex: "male",
      partnerIds: [motherId],
      childIds: [childId],
    }).toRecord(),
    new Person({
      id: motherId,
      name: "Maria",
      surname: "Bianchi",
      sex: "female",
      partnerIds: [fatherId],
      childIds: [childId],
    }).toRecord(),
    new Person({
      id: childId,
      name: "Leonardo",
      surname: "Rossi",
      sex: "male",
      parentIds: [fatherId, motherId],
    }).toRecord(),
  ];
}

function applySessionChanges(
  assets: Map<string, MediaAssetRecord>,
  changes: ArchiveMediaChanges,
): Map<string, MediaAssetRecord> {
  if (changes.replace) {
    return new Map(changes.replace.map((asset) => [asset.id, asset]));
  }
  const updated = new Map(assets);
  for (const id of changes.remove ?? []) {
    updated.delete(id);
  }
  if (changes.removePersonId) {
    for (const [id, asset] of updated) {
      if (asset.personId === changes.removePersonId) {
        updated.delete(id);
      }
    }
  }
  for (const asset of changes.put ?? []) {
    updated.set(asset.id, asset);
  }
  return updated;
}

export function useFamilyTreeStore() {
  const dbRef = useRef<MediaDB | null>(null);
  const stateRef = useRef<ArchiveState | null>(null);
  const writePending = useRef(false);
  const [state, setState] = useState<ArchiveState | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const database = new MediaDB();
    dbRef.current = database;
    let active = true;
    void (async () => {
      let nextState: ArchiveState;
      try {
        const cached = await database.getArchiveState();
        if (!active) {
          return;
        }
        if (cached.archive) {
          nextState = {
            snapshot: cached.archive.snapshot,
            revision: cached.archive.revision,
            assetIds: new Set(cached.assetIds),
            mediaEpoch: 0,
            needsArchiveSetup: false,
            sessionAssets: null,
          };
        } else {
          const legacy = new LocalStorageDB().loadWithStatus({ repair: false });
          const snapshot = removeLegacyAttachmentValues(legacy.snapshot);
          nextState = {
            snapshot,
            revision: null,
            assetIds: new Set(cached.assetIds),
            mediaEpoch: 0,
            needsArchiveSetup: legacy.status === "missing",
            sessionAssets: null,
          };
          if (legacy.status !== "missing") {
            try {
              const migrated = await database.commitArchive(snapshot, null);
              nextState.revision = migrated.revision;
            } catch (error) {
              if (error instanceof ArchiveConflictError) {
                const current = await database.getArchiveState();
                if (!current.archive) {
                  throw error;
                }
                nextState = {
                  snapshot: current.archive.snapshot,
                  revision: current.archive.revision,
                  assetIds: new Set(current.assetIds),
                  mediaEpoch: 0,
                  needsArchiveSetup: false,
                  sessionAssets: null,
                };
              } else if (isPersistenceCapabilityError(error)) {
                const records = await database.getArchiveAssets(
                  null,
                  getArchiveReferenceIds(snapshot).filter((id) => nextState.assetIds.has(id)),
                );
                nextState.sessionAssets = new Map(records.map((asset) => [asset.id, asset]));
              } else {
                throw error;
              }
            }
          } else if (legacy.persistenceStatus === "volatile") {
            // Existing legacy data may be temporarily inaccessible.
            nextState.sessionAssets = new Map();
          }
        }
      } catch (error) {
        if (!isPersistenceCapabilityError(error)) {
          throw error;
        }
        const legacy = new LocalStorageDB().loadWithStatus({ repair: false });
        nextState = {
          snapshot: removeLegacyAttachmentValues(legacy.snapshot),
          revision: null,
          assetIds: new Set(),
          mediaEpoch: 0,
          needsArchiveSetup: legacy.status === "missing",
          sessionAssets: new Map(),
        };
      }
      if (active) {
        stateRef.current = nextState;
        setState(nextState);
      }
    })().catch((error: unknown) => {
      if (active) {
        setLoadError(error instanceof Error ? error : new Error(String(error)));
      }
    });
    return () => {
      active = false;
      void database.close().catch(() => undefined);
    };
  }, []);

  const readAssets = useCallback(async (ids: readonly string[]) => {
    const current = stateRef.current;
    if (!current || ids.length === 0) {
      return [];
    }
    if (current.sessionAssets) {
      return ids.flatMap((id) => {
        const record = current.sessionAssets!.get(id);
        return record ? [record] : [];
      });
    }
    return dbRef.current!.getArchiveAssets(current.revision, ids);
  }, []);

  const readForExport = async () => {
    const current = stateRef.current;
    if (!current || current.needsArchiveSetup) {
      throw new Error("L’archivio non è disponibile.");
    }
    const ids = getArchiveReferenceIds(current.snapshot);
    const assets = current.sessionAssets
      ? ids.flatMap((id) => {
          const record = current.sessionAssets!.get(id);
          return record ? [record] : [];
        })
      : await dbRef.current!.getArchiveAssets(current.revision, ids);
    return { snapshot: current.snapshot, assets };
  };

  const updateArchive = async (
    getNextSnapshot: (snapshot: FamilyTreeSnapshot) => FamilyTreeSnapshot,
    changes: ArchiveMediaChanges = {},
  ) => {
    const current = stateRef.current;
    if (!current || writePending.current) {
      return false;
    }
    writePending.current = true;
    setBusy(true);
    try {
      const nextSnapshot = getNextSnapshot(current.snapshot);
      const snapshot = normalizeFamilyTree({
        ...nextSnapshot,
        metadata: { ...nextSnapshot.metadata, updatedAt: new Date().toISOString() },
      });
      let { revision, sessionAssets, assetIds } = current;
      if (!sessionAssets) {
        try {
          const saved = await dbRef.current!.commitArchive(snapshot, revision, changes);
          revision = saved.revision;
        } catch (error) {
          if (!isPersistenceCapabilityError(error)) {
            throw error;
          }
          const addedIds = new Set(changes.put?.map(({ id }) => id));
          const ids = changes.replace ? [] : getArchiveReferenceIds(snapshot);
          const retainedIds = ids.filter((id) => !addedIds.has(id) && current.assetIds.has(id));
          // Only switch to session storage if the retained durable media is readable.
          const retained = retainedIds.length
            ? await dbRef.current!.getArchiveAssets(current.revision, retainedIds)
            : [];
          if (retained.length !== retainedIds.length) {
            throw new Error("Non è stato possibile conservare tutti i file multimediali della sessione.");
          }
          sessionAssets = new Map(retained.map((asset) => [asset.id, asset]));
        }
      }
      if (sessionAssets) {
        sessionAssets = applySessionChanges(sessionAssets, changes);
        assetIds = new Set(sessionAssets.keys());
      } else if (changes.replace) {
        assetIds = new Set(changes.replace.map((asset) => asset.id));
      } else if (changes.put?.length || changes.remove?.length || changes.removePersonId) {
        const updatedIds = new Set(assetIds);
        const person = changes.removePersonId
          ? current.snapshot.people.find(({ id }) => id === changes.removePersonId)
          : undefined;
        for (const id of person ? getReferenceIds(person) : []) {
          updatedIds.delete(id);
        }
        for (const id of changes.remove ?? []) {
          updatedIds.delete(id);
        }
        for (const asset of changes.put ?? []) {
          updatedIds.add(asset.id);
        }
        assetIds = updatedIds;
      }
      const next = {
        snapshot,
        revision,
        sessionAssets,
        assetIds,
        mediaEpoch: current.mediaEpoch + (changes.replace ? 1 : 0),
        needsArchiveSetup: false,
      };
      stateRef.current = next;
      setState(next);
      return true;
    } finally {
      writePending.current = false;
      setBusy(false);
    }
  };

  const upsertPerson = (draft: PersonRecord, changes: ArchiveMediaChanges = {}) =>
    updateArchive((snapshot) => {
      const existingPerson = snapshot.people.find(({ id }) => id === draft.id);
      const timestamp = new Date().toISOString();
      const person = {
        ...draft,
        createdAt: existingPerson?.createdAt ?? draft.createdAt ?? timestamp,
        updatedAt: timestamp,
      };
      return { ...snapshot, people: reconcilePersonRelationships(snapshot.people, person) };
    }, changes);

  const deletePerson = (personId: string) =>
    updateArchive(
      (snapshot) => ({ ...snapshot, people: snapshot.people.filter(({ id }) => id !== personId) }),
      { removePersonId: personId },
    );

  const initializeArchive = (familyName: string) => {
    const normalized = familyName.trim();
    if (!stateRef.current?.needsArchiveSetup || !normalized) {
      return Promise.resolve(false);
    }
    return updateArchive((snapshot) => ({
      ...snapshot,
      people: createExampleFamily(),
      metadata: {
        ...snapshot.metadata,
        title: `Archivio della famiglia ${normalized}`,
        familyName: normalized,
      },
    }));
  };

  const replaceSnapshot = (snapshot: FamilyTreeSnapshot, assets: readonly MediaAssetRecord[]) =>
    updateArchive(() => removeLegacyAttachmentValues(snapshot), { replace: assets });

  return {
    snapshot: state?.snapshot ?? null,
    assetIds: state?.assetIds,
    mediaEpoch: state?.mediaEpoch ?? 0,
    needsArchiveSetup: state?.needsArchiveSetup ?? false,
    isVolatile: Boolean(state?.sessionAssets),
    busy,
    loadError,
    readAssets,
    readForExport,
    initializeArchive,
    replaceSnapshot,
    upsertPerson,
    deletePerson,
  };
}
