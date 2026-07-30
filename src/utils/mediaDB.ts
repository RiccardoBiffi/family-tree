import {
  validateMediaAssetRecord,
  type MediaAssetRecord,
  type MediaAssetRole,
  type MediaAssetValidationOptions,
} from "@/models/MediaAsset";

export const MEDIA_DB_NAME = "family-tree.media.v1";
export const MEDIA_DB_VERSION = 1;
export const MEDIA_ASSET_STORE_NAME = "assets";

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
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted."));
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
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(MEDIA_ASSET_STORE_NAME)) {
          database.createObjectStore(MEDIA_ASSET_STORE_NAME, {
            keyPath: "id",
          });
        }
      };
      request.onsuccess = () => {
        const database = request.result;
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
        reject(
          new MediaDBUnavailableError(
            "Media database upgrade is blocked by another tab.",
          ),
        );
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
