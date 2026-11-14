import {
  DEFAULT_ALLOWED_MEDIA_MIME_TYPES,
  DEFAULT_MAX_MEDIA_ASSET_BYTES,
  MEDIA_ASSET_RECORD_VERSION,
  MEDIA_ASSET_REFERENCE_PREFIX,
  MediaAssetValidationError,
  parseMediaAssetReference,
  validateMediaAssetRecord,
  type MediaAssetRecord,
  type MediaAssetRole,
} from "@/models/MediaAsset";
import {
  FAMILY_TREE_VERSION,
  type FamilyTreeSnapshot,
} from "@/models/FamilyTree";

export const ALBERO_PACKAGE_FORMAT = "family-tree.albero" as const;
export const ALBERO_PACKAGE_VERSION = 1 as const;
export const ALBERO_MIME_TYPE = "application/vnd.family-tree.albero+gzip";
export const ALBERO_FILE_EXTENSION = ".albero";

export const DEFAULT_ALBERO_PACKAGE_LIMITS = Object.freeze({
  maxCompressedBytes: 80 * 1024 * 1024,
  maxUncompressedBytes: 96 * 1024 * 1024,
  maxAssetCount: 500,
  maxAssetBytes: DEFAULT_MAX_MEDIA_ASSET_BYTES,
  maxTotalAssetBytes: 64 * 1024 * 1024,
  maxPeople: 10_000,
});

export interface AlberoPackageLimits {
  maxCompressedBytes: number;
  maxUncompressedBytes: number;
  maxAssetCount: number;
  maxAssetBytes: number;
  maxTotalAssetBytes: number;
  maxPeople: number;
}

export interface AlberoPackageOptions extends Partial<AlberoPackageLimits> {
  allowedMimeTypes?: readonly string[];
  exportedAt?: string;
}

export interface ImportedAlberoArchive {
  exportedAt: string;
  snapshot: FamilyTreeSnapshot;
  assets: MediaAssetRecord[];
}

export type AlberoPackageSource = Blob | ArrayBuffer | Uint8Array;

export type AlberoPackageErrorCode =
  | "COMPRESSION_UNAVAILABLE"
  | "PACKAGE_TOO_LARGE"
  | "INVALID_COMPRESSION"
  | "INVALID_JSON"
  | "WRONG_FORMAT"
  | "UNSUPPORTED_VERSION"
  | "INVALID_SNAPSHOT"
  | "INVALID_ASSET"
  | "UNSAFE_MEDIA";

export class AlberoPackageError extends Error {
  readonly code: AlberoPackageErrorCode;
  readonly cause?: unknown;

  constructor(
    code: AlberoPackageErrorCode,
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "AlberoPackageError";
    this.code = code;
    this.cause = cause;
  }
}

interface ResolvedAlberoPackageOptions extends AlberoPackageLimits {
  allowedMimeTypes: readonly string[];
  exportedAt: string;
}

function packageError(
  code: AlberoPackageErrorCode,
  message: string,
  cause?: unknown,
): never {
  throw new AlberoPackageError(code, message, cause);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function assertString(
  value: unknown,
  path: string,
  maxLength = 1_000_000,
): asserts value is string {
  if (typeof value !== "string" || value.length > maxLength) {
    packageError(
      "INVALID_SNAPSHOT",
      `${path} must be a string no longer than ${maxLength} characters.`,
    );
  }
}

function assertNullableString(
  value: unknown,
  path: string,
  maxLength = 1_000_000,
): asserts value is string | null {
  if (value === null) {
    return;
  }
  assertString(value, path, maxLength);
}

function assertTimestamp(
  value: unknown,
  path: string,
  code: AlberoPackageErrorCode = "INVALID_SNAPSHOT",
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    Number.isNaN(Date.parse(value))
  ) {
    packageError(code, `${path} must be a valid timestamp.`);
  }
}

function assertPersonDate(
  value: unknown,
  path: string,
): asserts value is string | null {
  if (value === null) {
    return;
  }

  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
    Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))
  ) {
    packageError("INVALID_SNAPSHOT", `${path} must be an ISO date or null.`);
  }
}

function assertCanonicalId(
  value: unknown,
  path: string,
  code: AlberoPackageErrorCode,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    packageError(code, `${path} must be a canonical identifier.`);
  }
}

function assertStringList(
  value: unknown,
  path: string,
  maxItems: number,
  maxEntryLength: number,
): asserts value is string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    packageError(
      "INVALID_SNAPSHOT",
      `${path} must be an array with at most ${maxItems} entries.`,
    );
  }

  for (let index = 0; index < value.length; index += 1) {
    assertString(value[index], `${path}[${index}]`, maxEntryLength);
  }
}

function assertNullableStringList(
  value: unknown,
  path: string,
  maxItems: number,
  maxEntryLength: number,
): asserts value is string[] | null {
  if (value === null) {
    return;
  }
  assertStringList(value, path, maxItems, maxEntryLength);
}

function assertPersonRecord(value: unknown, index: number): asserts value is Record<string, unknown> {
  const path = `snapshot.people[${index}]`;
  if (!isPlainRecord(value)) {
    packageError("INVALID_SNAPSHOT", `${path} must be an object.`);
  }

  assertCanonicalId(value.id, `${path}.id`, "INVALID_SNAPSHOT");
  assertString(value.name, `${path}.name`, 10_000);
  assertNullableString(value.knownAs, `${path}.knownAs`, 10_000);
  assertNullableString(value.surname, `${path}.surname`, 10_000);

  if (
    value.sex !== null &&
    value.sex !== "female" &&
    value.sex !== "male" &&
    value.sex !== "nonbinary" &&
    value.sex !== "unknown"
  ) {
    packageError("INVALID_SNAPSHOT", `${path}.sex is invalid.`);
  }

  assertPersonDate(value.birthDate, `${path}.birthDate`);
  assertNullableString(value.birthPlace, `${path}.birthPlace`, 100_000);
  assertPersonDate(value.deathDate, `${path}.deathDate`);
  assertNullableString(value.deathPlace, `${path}.deathPlace`, 100_000);
  assertNullableString(value.photo, `${path}.photo`, 2_000_000);
  assertNullableString(
    value.distinguishingMarks,
    `${path}.distinguishingMarks`,
  );
  assertNullableStringList(
    value.attachments,
    `${path}.attachments`,
    2_000,
    100_000,
  );
  assertNullableString(value.notes, `${path}.notes`);
  assertNullableString(value.profession, `${path}.profession`, 100_000);
  assertNullableString(value.instruction, `${path}.instruction`, 100_000);
  assertNullableStringList(value.tags, `${path}.tags`, 2_000, 10_000);
  assertStringList(value.parentIds, `${path}.parentIds`, 1_000, 256);
  assertStringList(value.childIds, `${path}.childIds`, 10_000, 256);
  assertStringList(value.partnerIds, `${path}.partnerIds`, 1_000, 256);
  assertTimestamp(value.createdAt, `${path}.createdAt`);
  assertTimestamp(value.updatedAt, `${path}.updatedAt`);
}

function validateFamilyTreeSnapshot(
  value: unknown,
  maxPeople: number,
): FamilyTreeSnapshot {
  if (!isPlainRecord(value)) {
    packageError("INVALID_SNAPSHOT", "snapshot must be an object.");
  }

  if (value.version !== FAMILY_TREE_VERSION) {
    packageError(
      "UNSUPPORTED_VERSION",
      `Unsupported family tree snapshot version: ${String(value.version)}.`,
    );
  }

  if (!isPlainRecord(value.metadata)) {
    packageError("INVALID_SNAPSHOT", "snapshot.metadata must be an object.");
  }

  assertString(value.metadata.title, "snapshot.metadata.title", 100_000);
  assertString(
    value.metadata.description,
    "snapshot.metadata.description",
    1_000_000,
  );
  assertString(
    value.metadata.familyName,
    "snapshot.metadata.familyName",
    100_000,
  );
  assertTimestamp(value.metadata.updatedAt, "snapshot.metadata.updatedAt");

  if (!Array.isArray(value.people) || value.people.length > maxPeople) {
    packageError(
      "INVALID_SNAPSHOT",
      `snapshot.people must contain at most ${maxPeople} people.`,
    );
  }

  const people = value.people;
  const peopleIds = new Set<string>();
  for (let index = 0; index < people.length; index += 1) {
    const person = people[index];
    assertPersonRecord(person, index);
    const personId = person.id as string;
    if (peopleIds.has(personId)) {
      packageError("INVALID_SNAPSHOT", `Duplicate person id: ${personId}.`);
    }
    peopleIds.add(personId);
  }

  const relationshipFields = ["parentIds", "childIds", "partnerIds"] as const;
  for (let index = 0; index < people.length; index += 1) {
    const person = people[index] as Record<string, unknown>;
    for (const field of relationshipFields) {
      const references = person[field] as string[];
      if (new Set(references).size !== references.length) {
        packageError(
          "INVALID_SNAPSHOT",
          `snapshot.people[${index}].${field} contains duplicate ids.`,
        );
      }
      for (const reference of references) {
        assertCanonicalId(
          reference,
          `snapshot.people[${index}].${field}`,
          "INVALID_SNAPSHOT",
        );
        if (reference === person.id || !peopleIds.has(reference)) {
          packageError(
            "INVALID_SNAPSHOT",
            `snapshot.people[${index}].${field} contains an invalid reference.`,
          );
        }
      }
    }
  }

  return value as unknown as FamilyTreeSnapshot;
}

interface MediaAssetExpectation {
  personId: string;
  role: MediaAssetRole;
  path: string;
}

type MediaAssetIdentity = Pick<
  MediaAssetRecord,
  "id" | "personId" | "role"
>;

function collectMediaAssetExpectations(
  snapshot: FamilyTreeSnapshot,
): Map<string, MediaAssetExpectation> {
  const expectations = new Map<string, MediaAssetExpectation>();

  const register = (
    reference: string,
    personId: string,
    role: MediaAssetRole,
    path: string,
  ): void => {
    if (!reference.startsWith(MEDIA_ASSET_REFERENCE_PREFIX)) {
      return;
    }

    const assetId = parseMediaAssetReference(reference);
    if (!assetId) {
      packageError(
        "INVALID_ASSET",
        `${path} contains an invalid media asset reference.`,
      );
    }

    const current = expectations.get(assetId);
    if (
      current &&
      (current.personId !== personId || current.role !== role)
    ) {
      packageError(
        "INVALID_ASSET",
        `Media asset ${assetId} is referenced by incompatible snapshot fields.`,
      );
    }

    expectations.set(assetId, { personId, role, path });
  };

  snapshot.people.forEach((person, personIndex) => {
    if (person.photo !== null) {
      register(
        person.photo,
        person.id,
        "photo",
        `snapshot.people[${personIndex}].photo`,
      );
    }

    person.attachments?.forEach((attachment, attachmentIndex) => {
      register(
        attachment,
        person.id,
        "attachment",
        `snapshot.people[${personIndex}].attachments[${attachmentIndex}]`,
      );
    });
  });

  return expectations;
}

function validateMediaAssetClosure(
  snapshot: FamilyTreeSnapshot,
  assets: readonly MediaAssetIdentity[],
): void {
  const expectations = collectMediaAssetExpectations(snapshot);
  const assetIds = new Set<string>();

  for (const asset of assets) {
    if (assetIds.has(asset.id)) {
      packageError("INVALID_ASSET", `Duplicate media asset id: ${asset.id}.`);
    }
    assetIds.add(asset.id);

    const expected = expectations.get(asset.id);
    if (!expected) {
      packageError(
        "INVALID_ASSET",
        `Media asset ${asset.id} is not referenced by the snapshot.`,
      );
    }
    if (
      asset.personId !== expected.personId ||
      asset.role !== expected.role
    ) {
      packageError(
        "INVALID_ASSET",
        `Media asset ${asset.id} does not match ${expected.path}.`,
      );
    }
  }

  for (const [assetId, expected] of expectations) {
    if (!assetIds.has(assetId)) {
      packageError(
        "INVALID_ASSET",
        `${expected.path} is missing media asset ${assetId}.`,
      );
    }
  }
}

function resolveOptions(options?: AlberoPackageOptions): ResolvedAlberoPackageOptions {
  const resolved: ResolvedAlberoPackageOptions = {
    ...DEFAULT_ALBERO_PACKAGE_LIMITS,
    ...options,
    allowedMimeTypes:
      options?.allowedMimeTypes ?? DEFAULT_ALLOWED_MEDIA_MIME_TYPES,
    exportedAt: options?.exportedAt ?? new Date().toISOString(),
  };

  const integerLimits: Array<keyof AlberoPackageLimits> = [
    "maxCompressedBytes",
    "maxUncompressedBytes",
    "maxAssetCount",
    "maxAssetBytes",
    "maxTotalAssetBytes",
    "maxPeople",
  ];

  for (const key of integerLimits) {
    if (!Number.isSafeInteger(resolved[key]) || resolved[key] <= 0) {
      packageError("PACKAGE_TOO_LARGE", `${key} must be a positive safe integer.`);
    }
  }

  assertTimestamp(resolved.exportedAt, "exportedAt", "INVALID_JSON");
  return resolved;
}

async function blobToBytes(blob: Blob): Promise<Uint8Array> {
  if (typeof blob.arrayBuffer === "function") {
    return new Uint8Array(await blob.arrayBuffer());
  }

  if (typeof FileReader === "undefined") {
    packageError(
      "INVALID_ASSET",
      "This environment cannot read Blob data.",
    );
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read Blob data."));
    reader.readAsArrayBuffer(blob);
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  const native = (bytes as Uint8Array & { toBase64?: () => string }).toBase64;
  return native
    ? native.call(bytes)
    : btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value: string, expectedSize: number): Uint8Array<ArrayBuffer> {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const firstNonAlphabet = /[^A-Za-z0-9+/]/u.exec(value);
  if (
    value.length % 4 !== 0 ||
    (firstNonAlphabet && firstNonAlphabet.index !== value.length - padding)
  ) {
    packageError("INVALID_ASSET", "Media asset data is not valid base64.");
  }
  if ((value.length / 4) * 3 - padding !== expectedSize) {
    packageError("INVALID_ASSET", "Media asset data size does not match metadata.");
  }

  try {
    const native = (Uint8Array as Uint8ArrayConstructor & {
      fromBase64?: (input: string) => Uint8Array<ArrayBuffer>;
    }).fromBase64;
    if (native) {
      return native.call(Uint8Array, value);
    }

    const bytes = new Uint8Array(expectedSize);
    const chunkSize = 64 * 1024;
    for (let offset = 0; offset < value.length; offset += chunkSize) {
      const binary = atob(value.slice(offset, offset + chunkSize));
      const byteOffset = (offset / 4) * 3;
      for (let index = 0; index < binary.length; index += 1) {
        bytes[byteOffset + index] = binary.charCodeAt(index);
      }
    }
    return bytes;
  } catch (error) {
    packageError("INVALID_ASSET", "Media asset data is not valid base64.", error);
  }
}

function limitBytes(maxBytes: number, label: string) {
  let total = 0;
  return new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>({
    transform(chunk, controller) {
      total += chunk.byteLength;
      if (total > maxBytes) {
        packageError(
          "PACKAGE_TOO_LARGE",
          "Archive exceeds the " + maxBytes + "-byte " + label + " limit.",
        );
      }
      controller.enqueue(chunk);
    },
  });
}

function streamFromChunks(
  chunks: AsyncGenerator<string>,
): ReadableStream<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      const next = await chunks.next();
      if (next.done) {
        controller.close();
      } else {
        controller.enqueue(encoder.encode(next.value) as Uint8Array<ArrayBuffer>);
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
}

async function readArchiveText(compressed: Blob, maxBytes: number): Promise<string> {
  if (typeof DecompressionStream === "undefined") {
    packageError(
      "COMPRESSION_UNAVAILABLE",
      "This browser does not support gzip DecompressionStream.",
    );
  }

  const reader = compressed.stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .pipeThrough(limitBytes(maxBytes, "uncompressed"))
    .getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const text: string[] = [];

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      try {
        text.push(decoder.decode(value, { stream: true }));
      } catch (error) {
        packageError("INVALID_JSON", "Archive text is not valid UTF-8.", error);
      }
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    if (error instanceof AlberoPackageError) {
      throw error;
    }
    packageError("INVALID_COMPRESSION", "Archive is not valid gzip data.", error);
  } finally {
    reader.releaseLock();
  }

  try {
    text.push(decoder.decode());
  } catch (error) {
    packageError("INVALID_JSON", "Archive text is not valid UTF-8.", error);
  }
  return text.join("");
}

function sourceToBlob(source: AlberoPackageSource, maxBytes: number): Blob {
  if (!(source instanceof Blob || source instanceof ArrayBuffer || source instanceof Uint8Array)) {
    packageError("WRONG_FORMAT", "Archive source must be a Blob or byte array.");
  }
  const size = source instanceof Blob ? source.size : source.byteLength;
  if (size === 0) {
    packageError("WRONG_FORMAT", "Archive file is empty.");
  }
  if (size > maxBytes) {
    packageError("PACKAGE_TOO_LARGE", "Archive exceeds the " + maxBytes + "-byte compressed limit.");
  }
  if (source instanceof Blob) {
    return source;
  }
  if (source instanceof ArrayBuffer) {
    return new Blob([source]);
  }

  const bytes = source.buffer instanceof ArrayBuffer
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : Uint8Array.from(source);
  return new Blob([bytes]);
}

async function* serializeArchive(
  snapshot: FamilyTreeSnapshot,
  assets: readonly MediaAssetRecord[],
  exportedAt: string,
): AsyncGenerator<string> {
  const header = JSON.stringify({
    format: ALBERO_PACKAGE_FORMAT,
    version: ALBERO_PACKAGE_VERSION,
    exportedAt,
  });
  yield header.slice(0, -1) + ',"snapshot":{"version":' + snapshot.version;
  yield ',"metadata":' + JSON.stringify(snapshot.metadata) + ',"people":[';
  for (const [index, person] of snapshot.people.entries()) {
    yield (index > 0 ? "," : "") + JSON.stringify(person);
  }
  yield ']},"assets":[';

  // Each non-final chunk is divisible by three, so only the final chunk adds padding.
  const chunkSize = 3 * 16 * 1024;
  for (const [index, asset] of assets.entries()) {
    const metadata = {
      version: asset.version,
      id: asset.id,
      personId: asset.personId,
      role: asset.role,
      name: asset.name,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
    yield (index > 0 ? "," : "") + JSON.stringify(metadata).slice(0, -1) + ',"data":"';
    for (let offset = 0; offset < asset.blob.size; offset += chunkSize) {
      const part = asset.blob.slice(offset, offset + chunkSize);
      yield bytesToBase64(await blobToBytes(part));
    }
    yield '"}';
  }
  yield "]}";
}

function validateSerializedAsset(
  value: unknown,
  index: number,
  options: ResolvedAlberoPackageOptions,
  personIds: ReadonlySet<string>,
  remainingBytes: number,
): MediaAssetRecord {
  const path = `assets[${index}]`;
  if (!isPlainRecord(value)) {
    packageError("INVALID_ASSET", `${path} must be an object.`);
  }

  if (value.version !== MEDIA_ASSET_RECORD_VERSION) {
    packageError(
      "UNSUPPORTED_VERSION",
      `Unsupported media asset version at ${path}.`,
    );
  }

  assertCanonicalId(value.id, `${path}.id`, "INVALID_ASSET");
  assertCanonicalId(value.personId, `${path}.personId`, "INVALID_ASSET");
  if (!personIds.has(value.personId)) {
    packageError("INVALID_ASSET", `${path}.personId is not in the snapshot.`);
  }

  if (value.role !== "photo" && value.role !== "attachment") {
    packageError("INVALID_ASSET", `${path}.role is invalid.`);
  }
  assertString(value.name, `${path}.name`, 255);
  assertString(value.mimeType, `${path}.mimeType`, 255);
  assertTimestamp(value.createdAt, `${path}.createdAt`, "INVALID_ASSET");
  assertTimestamp(value.updatedAt, `${path}.updatedAt`, "INVALID_ASSET");

  if (
    typeof value.size !== "number" ||
    !Number.isSafeInteger(value.size) ||
    value.size <= 0 ||
    value.size > options.maxAssetBytes
  ) {
    packageError(
      typeof value.size === "number" && value.size > options.maxAssetBytes
        ? "UNSAFE_MEDIA"
        : "INVALID_ASSET",
      `${path}.size is invalid or unsafe.`,
    );
  }

  if (value.size > remainingBytes) {
    packageError(
      "PACKAGE_TOO_LARGE",
      `Archive media exceeds the ${options.maxTotalAssetBytes}-byte total limit.`,
    );
  }
  assertString(value.data, `${path}.data`, options.maxUncompressedBytes);
  const bytes = base64ToBytes(value.data, value.size);
  const record: MediaAssetRecord = {
    version: MEDIA_ASSET_RECORD_VERSION,
    id: value.id,
    personId: value.personId,
    role: value.role,
    name: value.name,
    mimeType: value.mimeType,
    size: value.size,
    blob: new Blob([bytes], { type: value.mimeType }),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };

  try {
    return validateMediaAssetRecord(record, {
      maxAssetBytes: options.maxAssetBytes,
      allowedMimeTypes: options.allowedMimeTypes,
    });
  } catch (error) {
    packageError(
      error instanceof MediaAssetValidationError &&
        (error.code === "UNSAFE_MEDIA_TYPE" ||
          error.code === "MEDIA_ASSET_TOO_LARGE")
        ? "UNSAFE_MEDIA"
        : "INVALID_ASSET",
      `${path} failed media validation.`,
      error,
    );
  }
}

export async function exportAlberoPackage(
  snapshot: FamilyTreeSnapshot,
  assets: readonly MediaAssetRecord[],
  options?: AlberoPackageOptions,
): Promise<Blob> {
  const resolved = resolveOptions(options);
  const validatedSnapshot = validateFamilyTreeSnapshot(
    snapshot,
    resolved.maxPeople,
  );

  if (assets.length > resolved.maxAssetCount) {
    packageError(
      "PACKAGE_TOO_LARGE",
      `Archive contains more than ${resolved.maxAssetCount} media assets.`,
    );
  }

  const personIds = new Set(validatedSnapshot.people.map((person) => person.id));
  let totalAssetBytes = 0;
  const validatedAssets: MediaAssetRecord[] = [];

  for (const asset of assets) {
    let validated: MediaAssetRecord;
    try {
      validated = validateMediaAssetRecord(asset, {
        maxAssetBytes: resolved.maxAssetBytes,
        allowedMimeTypes: resolved.allowedMimeTypes,
      });
    } catch (error) {
      packageError(
        error instanceof MediaAssetValidationError &&
          (error.code === "UNSAFE_MEDIA_TYPE" ||
            error.code === "MEDIA_ASSET_TOO_LARGE")
          ? "UNSAFE_MEDIA"
          : "INVALID_ASSET",
        `Media asset ${asset?.id ?? "unknown"} failed validation.`,
        error,
      );
    }

    if (!personIds.has(validated.personId)) {
      packageError(
        "INVALID_ASSET",
        `Media asset ${validated.id} references a missing person.`,
      );
    }

    totalAssetBytes += validated.size;
    if (totalAssetBytes > resolved.maxTotalAssetBytes) {
      packageError(
        "PACKAGE_TOO_LARGE",
        `Archive media exceeds the ${resolved.maxTotalAssetBytes}-byte total limit.`,
      );
    }
    validatedAssets.push(validated);
  }

  validateMediaAssetClosure(validatedSnapshot, validatedAssets);

  if (typeof CompressionStream === "undefined") {
    packageError(
      "COMPRESSION_UNAVAILABLE",
      "This browser does not support gzip CompressionStream.",
    );
  }
  const stream = streamFromChunks(
    serializeArchive(validatedSnapshot, validatedAssets, resolved.exportedAt),
  )
    .pipeThrough(limitBytes(resolved.maxUncompressedBytes, "uncompressed"))
    .pipeThrough(new CompressionStream("gzip"))
    .pipeThrough(limitBytes(resolved.maxCompressedBytes, "compressed"));
  return new Response(stream, {
    headers: { "Content-Type": ALBERO_MIME_TYPE },
  }).blob();
}

export async function importAlberoPackage(
  source: AlberoPackageSource,
  options?: AlberoPackageOptions,
): Promise<ImportedAlberoArchive> {
  const resolved = resolveOptions(options);
  const compressed = sourceToBlob(source, resolved.maxCompressedBytes);
  const header = await blobToBytes(compressed.slice(0, 2));
  if (header[0] !== 0x1f || header[1] !== 0x8b) {
    packageError("INVALID_COMPRESSION", "Archive is not gzip-compressed data.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await readArchiveText(compressed, resolved.maxUncompressedBytes));
  } catch (error) {
    if (error instanceof AlberoPackageError) {
      throw error;
    }
    packageError("INVALID_JSON", "Archive does not contain valid JSON.", error);
  }

  if (!isPlainRecord(parsed)) {
    packageError("WRONG_FORMAT", "Archive root must be an object.");
  }
  if (parsed.format !== ALBERO_PACKAGE_FORMAT) {
    packageError("WRONG_FORMAT", "File is not a family-tree .albero archive.");
  }
  if (parsed.version !== ALBERO_PACKAGE_VERSION) {
    packageError(
      "UNSUPPORTED_VERSION",
      `Unsupported .albero package version: ${String(parsed.version)}.`,
    );
  }
  assertTimestamp(parsed.exportedAt, "exportedAt", "INVALID_JSON");

  const snapshot = validateFamilyTreeSnapshot(parsed.snapshot, resolved.maxPeople);
  if (!Array.isArray(parsed.assets)) {
    packageError("INVALID_ASSET", "assets must be an array.");
  }
  if (parsed.assets.length > resolved.maxAssetCount) {
    packageError(
      "PACKAGE_TOO_LARGE",
      `Archive contains more than ${resolved.maxAssetCount} media assets.`,
    );
  }

  const personIds = new Set(snapshot.people.map((person) => person.id));
  const assets: MediaAssetRecord[] = [];
  let totalAssetBytes = 0;

  for (let index = 0; index < parsed.assets.length; index += 1) {
    const asset = validateSerializedAsset(
      parsed.assets[index],
      index,
      resolved,
      personIds,
      resolved.maxTotalAssetBytes - totalAssetBytes,
    );

    totalAssetBytes += asset.size;
    assets.push(asset);
    parsed.assets[index] = null;
  }

  validateMediaAssetClosure(snapshot, assets);

  return {
    exportedAt: parsed.exportedAt,
    snapshot,
    assets,
  };
}
