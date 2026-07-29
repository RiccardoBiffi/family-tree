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

interface SerializedMediaAssetRecord {
  version: typeof MEDIA_ASSET_RECORD_VERSION;
  id: string;
  personId: string;
  role: MediaAssetRole;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  data: string;
}

interface AlberoPackageDocument {
  format: typeof ALBERO_PACKAGE_FORMAT;
  version: typeof ALBERO_PACKAGE_VERSION;
  exportedAt: string;
  snapshot: FamilyTreeSnapshot;
  assets: SerializedMediaAssetRecord[];
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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return Uint8Array.from(bytes).buffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...Array.from(bytes.subarray(offset, offset + chunkSize)),
    );
  }

  return btoa(binary);
}

function decodedBase64Size(value: string): number {
  if (value.length === 0) {
    return 0;
  }

  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

function base64ToBytes(value: string): Uint8Array {
  if (
    value.length % 4 !== 0 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)
  ) {
    packageError("INVALID_ASSET", "Media asset data is not valid base64.");
  }

  let binary: string;
  try {
    binary = atob(value);
  } catch (error) {
    packageError("INVALID_ASSET", "Media asset data is not valid base64.", error);
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readStreamWithLimit(
  stream: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        packageError(
          "PACKAGE_TOO_LARGE",
          `Archive expands beyond the ${maxBytes}-byte limit.`,
        );
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function compressGzip(
  bytes: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> {
  if (typeof CompressionStream === "undefined") {
    packageError(
      "COMPRESSION_UNAVAILABLE",
      "This browser does not support gzip CompressionStream.",
    );
  }

  const stream = new Blob([bytesToArrayBuffer(bytes)])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  return readStreamWithLimit(stream, maxBytes);
}

async function decompressGzip(
  bytes: Uint8Array,
  maxBytes: number,
): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    packageError(
      "COMPRESSION_UNAVAILABLE",
      "This browser does not support gzip DecompressionStream.",
    );
  }

  try {
    const stream = new Blob([bytesToArrayBuffer(bytes)])
      .stream()
      .pipeThrough(new DecompressionStream("gzip"));
    return await readStreamWithLimit(stream, maxBytes);
  } catch (error) {
    if (error instanceof AlberoPackageError) {
      throw error;
    }
    packageError("INVALID_COMPRESSION", "Archive is not valid gzip data.", error);
  }
}

async function sourceToBytes(
  source: AlberoPackageSource,
  maxBytes: number,
): Promise<Uint8Array> {
  let bytes: Uint8Array;

  if (source instanceof Blob) {
    if (source.size > maxBytes) {
      packageError(
        "PACKAGE_TOO_LARGE",
        `Archive exceeds the ${maxBytes}-byte compressed limit.`,
      );
    }
    bytes = await blobToBytes(source);
  } else if (source instanceof ArrayBuffer) {
    bytes = new Uint8Array(source.slice(0));
  } else if (source instanceof Uint8Array) {
    bytes = Uint8Array.from(source);
  } else {
    packageError("WRONG_FORMAT", "Archive source must be a Blob or byte array.");
  }

  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) {
    packageError(
      bytes.byteLength === 0 ? "WRONG_FORMAT" : "PACKAGE_TOO_LARGE",
      bytes.byteLength === 0
        ? "Archive file is empty."
        : `Archive exceeds the ${maxBytes}-byte compressed limit.`,
    );
  }

  return bytes;
}

function validateSerializedAsset(
  value: unknown,
  index: number,
  options: ResolvedAlberoPackageOptions,
  personIds: ReadonlySet<string>,
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
    !Number.isSafeInteger(value.size) ||
    (value.size as number) <= 0 ||
    (value.size as number) > options.maxAssetBytes
  ) {
    packageError(
      (value.size as number) > options.maxAssetBytes
        ? "UNSAFE_MEDIA"
        : "INVALID_ASSET",
      `${path}.size is invalid or unsafe.`,
    );
  }

  assertString(value.data, `${path}.data`, options.maxUncompressedBytes);
  if (decodedBase64Size(value.data) !== value.size) {
    packageError("INVALID_ASSET", `${path}.data size does not match metadata.`);
  }

  const bytes = base64ToBytes(value.data);
  const record: MediaAssetRecord = {
    version: MEDIA_ASSET_RECORD_VERSION,
    id: value.id,
    personId: value.personId,
    role: value.role,
    name: value.name,
    mimeType: value.mimeType,
    size: value.size,
    blob: new Blob([bytesToArrayBuffer(bytes)], { type: value.mimeType }),
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
  const serializedAssets: SerializedMediaAssetRecord[] = [];

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

  for (const validated of validatedAssets) {
    const bytes = await blobToBytes(validated.blob);
    serializedAssets.push({
      version: validated.version,
      id: validated.id,
      personId: validated.personId,
      role: validated.role,
      name: validated.name,
      mimeType: validated.mimeType,
      size: validated.size,
      createdAt: validated.createdAt,
      updatedAt: validated.updatedAt,
      data: bytesToBase64(bytes),
    });
  }

  const document: AlberoPackageDocument = {
    format: ALBERO_PACKAGE_FORMAT,
    version: ALBERO_PACKAGE_VERSION,
    exportedAt: resolved.exportedAt,
    snapshot: validatedSnapshot,
    assets: serializedAssets,
  };
  const uncompressed = new TextEncoder().encode(JSON.stringify(document));
  if (uncompressed.byteLength > resolved.maxUncompressedBytes) {
    packageError(
      "PACKAGE_TOO_LARGE",
      `Archive exceeds the ${resolved.maxUncompressedBytes}-byte uncompressed limit.`,
    );
  }

  const compressed = await compressGzip(
    uncompressed,
    resolved.maxCompressedBytes,
  );
  return new Blob([bytesToArrayBuffer(compressed)], {
    type: ALBERO_MIME_TYPE,
  });
}

export async function importAlberoPackage(
  source: AlberoPackageSource,
  options?: AlberoPackageOptions,
): Promise<ImportedAlberoArchive> {
  const resolved = resolveOptions(options);
  const compressed = await sourceToBytes(source, resolved.maxCompressedBytes);

  if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) {
    packageError("INVALID_COMPRESSION", "Archive is not gzip-compressed data.");
  }

  const uncompressed = await decompressGzip(
    compressed,
    resolved.maxUncompressedBytes,
  );

  let json: string;
  try {
    json = new TextDecoder("utf-8", { fatal: true }).decode(uncompressed);
  } catch (error) {
    packageError("INVALID_JSON", "Archive text is not valid UTF-8.", error);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
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
    );

    totalAssetBytes += asset.size;
    if (totalAssetBytes > resolved.maxTotalAssetBytes) {
      packageError(
        "PACKAGE_TOO_LARGE",
        `Archive media exceeds the ${resolved.maxTotalAssetBytes}-byte total limit.`,
      );
    }
    assets.push(asset);
  }

  validateMediaAssetClosure(snapshot, assets);

  return {
    exportedAt: parsed.exportedAt,
    snapshot,
    assets,
  };
}
