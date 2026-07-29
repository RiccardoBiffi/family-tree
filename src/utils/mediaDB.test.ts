import { Blob as NodeBlob } from "node:buffer";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createMediaAssetRecord, type MediaAssetRecord } from "@/models/MediaAsset";
import { MediaDB, MediaDBUnavailableError } from "@/utils/mediaDB";

interface FakeDatabaseState {
  records: Map<string, MediaAssetRecord>;
  storeCreated: boolean;
  transactionModes: IDBTransactionMode[];
}

class FakeRequest<Result> {
  result!: Result;
  error: DOMException | null = null;
  onsuccess: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  succeed(result: Result): void {
    this.result = result;
    this.onsuccess?.(new Event("success"));
  }

  fail(error: DOMException): void {
    this.error = error;
    this.onerror?.(new Event("error"));
  }
}

class FakeTransaction {
  error: DOMException | null = null;
  oncomplete: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onabort: ((event: Event) => void) | null = null;
  private pending = 0;
  private failed = false;

  constructor(private readonly state: FakeDatabaseState) {}

  objectStore(): IDBObjectStore {
    return new FakeObjectStore(this.state, this) as unknown as IDBObjectStore;
  }

  request<Result>(operation: () => Result): IDBRequest<Result> {
    this.pending += 1;
    const request = new FakeRequest<Result>();

    queueMicrotask(() => {
      if (this.failed) {
        return;
      }

      try {
        request.succeed(operation());
        this.pending -= 1;
        if (this.pending === 0) {
          queueMicrotask(() => this.oncomplete?.(new Event("complete")));
        }
      } catch (error) {
        this.failed = true;
        this.error = new DOMException(String(error), "UnknownError");
        request.fail(this.error);
        this.onerror?.(new Event("error"));
        this.onabort?.(new Event("abort"));
      }
    });

    return request as unknown as IDBRequest<Result>;
  }
}

class FakeObjectStore {
  constructor(
    private readonly state: FakeDatabaseState,
    private readonly transaction: FakeTransaction,
  ) {}

  put(value: MediaAssetRecord): IDBRequest<IDBValidKey> {
    return this.transaction.request<IDBValidKey>(() => {
      this.state.records.set(value.id, value);
      return value.id;
    });
  }

  get(key: IDBValidKey): IDBRequest<MediaAssetRecord | undefined> {
    return this.transaction.request(() => this.state.records.get(String(key)));
  }

  getAll(): IDBRequest<MediaAssetRecord[]> {
    return this.transaction.request(() => Array.from(this.state.records.values()));
  }

  delete(key: IDBValidKey): IDBRequest<undefined> {
    return this.transaction.request(() => {
      this.state.records.delete(String(key));
      return undefined;
    });
  }

  clear(): IDBRequest<undefined> {
    return this.transaction.request(() => {
      this.state.records.clear();
      return undefined;
    });
  }
}

class FakeDatabase {
  onversionchange: ((event: Event) => void) | null = null;

  constructor(private readonly state: FakeDatabaseState) {}

  get objectStoreNames() {
    return {
      contains: (name: string) => name === "assets" && this.state.storeCreated,
    } as DOMStringList;
  }

  createObjectStore(name: string): IDBObjectStore {
    if (name !== "assets") {
      throw new Error(`Unexpected object store: ${name}`);
    }
    this.state.storeCreated = true;
    return {} as IDBObjectStore;
  }

  transaction(_name: string, mode: IDBTransactionMode): IDBTransaction {
    if (!this.state.storeCreated) {
      throw new DOMException("Object store is missing.", "NotFoundError");
    }
    this.state.transactionModes.push(mode);
    return new FakeTransaction(this.state) as unknown as IDBTransaction;
  }

  close(): void {}
}

class FakeOpenRequest extends FakeRequest<IDBDatabase> {
  onupgradeneeded: ((event: IDBVersionChangeEvent) => void) | null = null;
  onblocked: ((event: Event) => void) | null = null;
}

class FakeIndexedDBFactory {
  private readonly databases = new Map<string, FakeDatabaseState>();

  open(name: string): IDBOpenDBRequest {
    const request = new FakeOpenRequest();

    queueMicrotask(() => {
      let state = this.databases.get(name);
      const needsUpgrade = !state;
      if (!state) {
        state = {
          records: new Map(),
          storeCreated: false,
          transactionModes: [],
        };
        this.databases.set(name, state);
      }

      const database = new FakeDatabase(state);
      request.result = database as unknown as IDBDatabase;
      if (needsUpgrade) {
        request.onupgradeneeded?.(
          new Event("upgradeneeded") as IDBVersionChangeEvent,
        );
      }
      request.onsuccess?.(new Event("success"));
    });

    return request as unknown as IDBOpenDBRequest;
  }

  state(name: string): FakeDatabaseState {
    const state = this.databases.get(name);
    if (!state) {
      throw new Error(`Database ${name} was not opened.`);
    }
    return state;
  }
}

beforeAll(() => {
  vi.stubGlobal("Blob", NodeBlob);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

function asset(
  id: string,
  personId: string,
  role: "photo" | "attachment",
): MediaAssetRecord {
  return createMediaAssetRecord({
    id,
    personId,
    role,
    name: `${id}.png`,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
    createdAt: "2026-07-29T10:00:00.000Z",
    updatedAt: "2026-07-29T10:00:00.000Z",
  });
}

describe("MediaDB", () => {
  it("persists, queries, deletes, clears, and atomically replaces Blob records", async () => {
    const factory = new FakeIndexedDBFactory();
    const databaseName = "family-tree.media.test";
    const db = new MediaDB({
      dbName: databaseName,
      indexedDB: factory as unknown as IDBFactory,
    });
    const photo = asset("asset-photo", "p1", "photo");
    const attachment = asset("asset-attachment", "p2", "attachment");

    expect(db.isAvailable()).toBe(true);
    await db.put(photo);
    await db.put(attachment);

    expect(factory.state(databaseName).storeCreated).toBe(true);
    expect(await db.get(photo.id)).toMatchObject({
      id: photo.id,
      personId: "p1",
      size: 3,
    });
    expect(await db.list({ personId: "p1" })).toHaveLength(1);
    expect(await db.list({ role: "attachment" })).toEqual([attachment]);

    await db.delete(photo.id);
    expect(await db.get(photo.id)).toBeNull();

    const replacement = asset("asset-replacement", "p3", "photo");
    const transactionCount = factory.state(databaseName).transactionModes.length;
    await db.replaceAll([replacement]);
    expect(
      factory.state(databaseName).transactionModes.slice(transactionCount),
    ).toEqual(["readwrite"]);
    expect(await db.list()).toEqual([replacement]);

    await expect(db.replaceAll([replacement, replacement])).rejects.toThrow(
      /Duplicate media asset id/u,
    );
    expect(await db.list()).toEqual([replacement]);

    await db.clear();
    expect(await db.list()).toEqual([]);
    await db.close();
  });

  it("fails explicitly when IndexedDB is unavailable", async () => {
    const db = new MediaDB({ indexedDB: null });

    expect(db.isAvailable()).toBe(false);
    await expect(db.list()).rejects.toBeInstanceOf(MediaDBUnavailableError);
  });
});
