import { vi } from "vitest";

import type { MediaAssetRecord } from "@/models/MediaAsset";
import { ArchiveConflictError, MediaDB, type StoredArchive } from "@/utils/mediaDB";

export function mockArchiveDB(initialAssets: readonly MediaAssetRecord[] = []) {
  let archive: StoredArchive | null = null;
  const assets = new Map(initialAssets.map((asset) => [asset.id, asset]));

  const read = vi.spyOn(MediaDB.prototype, "getArchiveState").mockImplementation(async () => ({
    archive,
    assetIds: [...assets.keys()],
  }));
  const readAssets = vi.spyOn(MediaDB.prototype, "getArchiveAssets").mockImplementation(
    async (revision, ids) => {
      if ((archive?.revision ?? null) !== revision) {
        throw new ArchiveConflictError();
      }
      return ids.flatMap((id) => {
        const asset = assets.get(id);
        return asset ? [asset] : [];
      });
    },
  );
  const commit = vi.spyOn(MediaDB.prototype, "commitArchive").mockImplementation(
    async (snapshot, revision, changes = {}) => {
      if ((archive?.revision ?? null) !== revision) {
        throw new ArchiveConflictError();
      }
      if (changes.replace) {
        assets.clear();
        for (const asset of changes.replace) {
          assets.set(asset.id, asset);
        }
      } else {
        for (const id of changes.remove ?? []) {
          assets.delete(id);
        }
        if (changes.removePersonId) {
          for (const [id, asset] of assets) {
            if (asset.personId === changes.removePersonId) {
              assets.delete(id);
            }
          }
        }
        for (const asset of changes.put ?? []) {
          assets.set(asset.id, asset);
        }
      }
      archive = { id: "current", snapshot, revision: (revision ?? 0) + 1 };
      return archive;
    },
  );

  return {
    read,
    readAssets,
    commit,
    get snapshot() { return archive?.snapshot; },
    assets,
  };
}
