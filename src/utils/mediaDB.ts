import type { FamilyTreeSnapshot } from "@/models/FamilyTree";
import {
  validateMediaAssetRecord,
  type MediaAssetRecord,
  type MediaAssetRole,
  type MediaAssetValidationOptions,
} from "@/models/MediaAsset";

export const MEDIA_DB_NAME = "family-tree.media.v1";
export const MEDIA_DB_VERSION = 2;
export const MEDIA_ASSET_STORE_NAME = "assets";
export const ARCHIVE_STORE_NAME = "archive";
const ARCHIVE_KEY = "current";
const PERSON_ID_INDEX = "personId";

export interface StoredArchive {
  id: typeof ARCHIVE_KEY;
  snapshot: FamilyTreeSnapshot;
  revision: number;
}

export interface ArchiveMediaChanges {
  put?: readonly MediaAssetRecord[];
  remove?: readonly string[];
  removePersonId?: string;
  replace?: readonly MediaAssetRecord[];
}

export class ArchiveConflictError extends Error {
  constructor() {
    super("L’archivio è stato modificato in un’altra scheda. Ricarica la pagina per continuare.");
    this.name = "ArchiveConflictError";
  }
}

export interface MediaAssetQuery {
  personId?: string;
  role?: MediaAssetRole;
}

export interface MediaDBOptions {
  dbName?: string;
  indexedDB?: IDBFactory | null;
  validation?: MediaAssetValidationOptions;
}

export class MediaDBUnavailableError extends Error {
  constructor(
    message = "IndexedDB is not available in this environment.",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MediaDBUnavailableError";
  }
}

export class MediaDBUpgradeBlockedError extends Error {
  constructor() {
    super("Chiudi le altre schede dell’archivio e ricarica la pagina per completare l’aggiornamento.");
    this.name = "MediaDBUpgradeBlockedError";
  }
}

function getDefaultIndexedDB(): IDBFactory | null {
  try {
    return typeof globalThis.indexedDB === "undefined"
      ? null
      : globalThis.indexedDB;
  } catch {
    return null;
  }
}

function requestToPromise<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    let requestError: DOMException | null = null;
    transaction.oncomplete = () => resolve();
    transaction.onerror = (event) => {
      requestError = (event.target as IDBRequest | null)?.error ?? null;
    };
    transaction.onabort = () => reject(
      transaction.error ?? requestError ??
        new DOMException("IndexedDB transaction was aborted.", "AbortError"),
    );
  });
}

function assertQuery(query: MediaAssetQuery): void {
  if (
    query.personId !== undefined &&
    (query.personId.length === 0 || query.personId !== query.personId.trim())
  ) {
    throw new TypeError("Media asset query personId must be canonical.");
  }

  if (
    query.role !== undefined &&
    query.role !== "photo" &&
    query.role !== "attachment"
  ) {
    throw new TypeError("Media asset query role is invalid.");
  }
}

export class MediaDB {
  readonly dbName: string;

  private readonly factory: IDBFactory | null;
  private readonly validation: MediaAssetValidationOptions | undefined;
  private databasePromise: Promise<IDBDatabase> | null = null;

  constructor(options: MediaDBOptions = {}) {
    this.dbName = options.dbName?.trim() || MEDIA_DB_NAME;
    this.factory =
      options.indexedDB === undefined
        ? getDefaultIndexedDB()
        : options.indexedDB;
    this.validation = options.validation;
  }

  isAvailable(): boolean {
    return this.factory !== null;
  }

  private open(): Promise<IDBDatabase> {
    if (!this.factory) {
      return Promise.reject(new MediaDBUnavailableError());
    }

    if (this.databasePromise) {
      return this.databasePromise;
    }

    let request: IDBOpenDBRequest;
    try {
      request = this.factory.open(this.dbName, MEDIA_DB_VERSION);
    } catch (error) {
      return Promise.reject(
        new MediaDBUnavailableError("Unable to open the media database.", {
          cause: error,
        }),
      );
    }
    const pending = new Promise<IDBDatabase>((resolve, reject) => {
      let blocked = false;
      request.onupgradeneeded = () => {
        const database = request.result;
        const assets = database.objectStoreNames.contains(MEDIA_ASSET_STORE_NAME)
          ? request.transaction!.objectStore(MEDIA_ASSET_STORE_NAME)
          : database.createObjectStore(MEDIA_ASSET_STORE_NAME, { keyPath: "id" });
        if (!assets.indexNames.contains(PERSON_ID_INDEX)) {
          assets.createIndex(PERSON_ID_INDEX, "personId");
        }
        if (!database.objectStoreNames.contains(ARCHIVE_STORE_NAME)) {
          database.createObjectStore(ARCHIVE_STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (blocked) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          this.databasePromise = null;
        };
        resolve(database);
      };
      request.onerror = () => {
        reject(
          new MediaDBUnavailableError(
            "Unable to open the media database.",
            request.error ? { cause: request.error } : undefined,
          ),
        );
      };
      request.onblocked = () => {
        blocked = true;
        reject(new MediaDBUpgradeBlockedError());
      };
    });

    this.databasePromise = pending;
    void pending.catch(() => {
      if (this.databasePromise === pending) {
        this.databasePromise = null;
      }
    });

    return pending;
  }

  async getArchiveState(): Promise<{ archive: StoredArchive | null; assetIds: string[] }> {
    const database = await this.open();
    const transaction = database.transaction(
      [ARCHIVE_STORE_NAME, MEDIA_ASSET_STORE_NAME],
      "readonly",
    );
    const [archive, assetIds] = await Promise.all([
      requestToPromise<StoredArchive | undefined>(
        transaction.objectStore(ARCHIVE_STORE_NAME).get(ARCHIVE_KEY),
      ),
      requestToPromise(
        transaction.objectStore(MEDIA_ASSET_STORE_NAME).getAllKeys(),
      ),
      transactionToPromise(transaction),
    ]);
    return {
      archive: archive ?? null,
      assetIds: assetIds.filter((id): id is string => typeof id === "string"),
    };
  }

  async getArchiveAssets(
    expectedRevision: number | null,
    ids: readonly string[],
  ): Promise<MediaAssetRecord[]> {
    const database = await this.open();
    const transaction = database.transaction(
      [ARCHIVE_STORE_NAME, MEDIA_ASSET_STORE_NAME],
      "readonly",
    );
    const archiveRequest = transaction.objectStore(ARCHIVE_STORE_NAME).get(ARCHIVE_KEY);
    const assetStore = transaction.objectStore(MEDIA_ASSET_STORE_NAME);
    const assetRequests = ids.map((id) =>
      requestToPromise<MediaAssetRecord | undefined>(assetStore.get(id)),
    );
    const [archive, records] = await Promise.all([
      requestToPromise<StoredArchive | undefined>(archiveRequest),
      Promise.all(assetRequests),
      transactionToPromise(transaction),
    ]);
    if ((archive?.revision ?? null) !== expectedRevision) {
      throw new ArchiveConflictError();
    }
    return records
      .filter((record): record is MediaAssetRecord => record !== undefined)
      .map((record) => validateMediaAssetRecord(record, this.validation));
  }

  async commitArchive(
    snapshot: FamilyTreeSnapshot,
    expectedRevision: number | null,
    changes: ArchiveMediaChanges = {},
  ): Promise<StoredArchive> {
    const updates = changes.replace ?? changes.put ?? [];
    const seenIds = new Set<string>();
    for (const asset of updates) {
      validateMediaAssetRecord(asset, this.validation);
      if (seenIds.has(asset.id)) {
        throw new TypeError(`Duplicate media asset id: ${asset.id}.`);
      }
      seenIds.add(asset.id);
    }
    const database = await this.open();
    const mediaChanged = Boolean(
      changes.replace || updates.length || changes.remove?.length || changes.removePersonId,
    );
    const transaction = database.transaction(
      mediaChanged ? [ARCHIVE_STORE_NAME, MEDIA_ASSET_STORE_NAME] : ARCHIVE_STORE_NAME,
      "readwrite",
    );
    const archiveStore = transaction.objectStore(ARCHIVE_STORE_NAME);
    const nextArchive: StoredArchive = {
      id: ARCHIVE_KEY,
      snapshot,
      revision: (expectedRevision ?? 0) + 1,
    };
    let failure: unknown;
    const completion = transactionToPromise(transaction);
    const previous = archiveStore.get(ARCHIVE_KEY);
    previous.onsuccess = () => {
      try {
        const current = previous.result as StoredArchive | undefined;
        if ((current?.revision ?? null) !== expectedRevision) {
          throw new ArchiveConflictError();
        }
        archiveStore.put(nextArchive);
        if (mediaChanged) {
          const mediaStore = transaction.objectStore(MEDIA_ASSET_STORE_NAME);
          if (changes.replace) {
            mediaStore.clear();
          } else {
            for (const id of changes.remove ?? []) {
              mediaStore.delete(id);
            }
            if (changes.removePersonId) {
              const cursorRequest = mediaStore.index(PERSON_ID_INDEX)
                .openKeyCursor(changes.removePersonId);
              cursorRequest.onsuccess = () => {
                const cursor = cursorRequest.result;
                if (cursor) {
                  mediaStore.delete(cursor.primaryKey);
                  cursor.continue();
                }
              };
            }
          }
          for (const asset of updates) {
            mediaStore.put(asset);
          }
        }
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
    try {
      await completion;
    } catch (error) {
      throw failure ?? error;
    }
    return nextArchive;
  }

  async put(asset: MediaAssetRecord): Promise<MediaAssetRecord> {
    validateMediaAssetRecord(asset, this.validation);
    const database = await this.open();
    const transaction = database.transaction(
      MEDIA_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);

    await Promise.all([
      requestToPromise(store.put(asset)),
      transactionToPromise(transaction),
    ]);
    return asset;
  }

  async get(assetId: string): Promise<MediaAssetRecord | null> {
    const database = await this.open();
    const transaction = database.transaction(MEDIA_ASSET_STORE_NAME, "readonly");
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);
    const [result] = await Promise.all([
      requestToPromise<MediaAssetRecord | undefined>(store.get(assetId)),
      transactionToPromise(transaction),
    ]);

    if (!result) {
      return null;
    }

    return validateMediaAssetRecord(result, this.validation);
  }

  async list(query: MediaAssetQuery = {}): Promise<MediaAssetRecord[]> {
    assertQuery(query);
    const database = await this.open();
    const transaction = database.transaction(MEDIA_ASSET_STORE_NAME, "readonly");
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);
    const [records] = await Promise.all([
      requestToPromise<MediaAssetRecord[]>(store.getAll()),
      transactionToPromise(transaction),
    ]);

    return records
      .map((record) => validateMediaAssetRecord(record, this.validation))
      .filter(
        (record) =>
          (query.personId === undefined || record.personId === query.personId) &&
          (query.role === undefined || record.role === query.role),
      )
      .sort((left, right) =>
        left.createdAt === right.createdAt
          ? left.id.localeCompare(right.id)
          : left.createdAt.localeCompare(right.createdAt),
      );
  }

  async delete(assetId: string): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(
      MEDIA_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);

    await Promise.all([
      requestToPromise(store.delete(assetId)),
      transactionToPromise(transaction),
    ]);
  }

  async clear(): Promise<void> {
    const database = await this.open();
    const transaction = database.transaction(
      MEDIA_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);

    await Promise.all([
      requestToPromise(store.clear()),
      transactionToPromise(transaction),
    ]);
  }

  async replaceAll(assets: readonly MediaAssetRecord[]): Promise<void> {
    const seenIds = new Set<string>();
    for (const asset of assets) {
      validateMediaAssetRecord(asset, this.validation);
      if (seenIds.has(asset.id)) {
        throw new TypeError(`Duplicate media asset id: ${asset.id}.`);
      }
      seenIds.add(asset.id);
    }

    const database = await this.open();
    const transaction = database.transaction(
      MEDIA_ASSET_STORE_NAME,
      "readwrite",
    );
    const store = transaction.objectStore(MEDIA_ASSET_STORE_NAME);
    const requests: IDBRequest[] = [store.clear()];

    for (const asset of assets) {
      requests.push(store.put(asset));
    }

    await Promise.all([
      ...requests.map((request) => requestToPromise(request)),
      transactionToPromise(transaction),
    ]);
  }

  async close(): Promise<void> {
    const pending = this.databasePromise;
    this.databasePromise = null;

    if (pending) {
      const database = await pending;
      database.close();
    }
  }
}
