export const MEDIA_ASSET_RECORD_VERSION = 1 as const;
export const MEDIA_ASSET_REFERENCE_PREFIX = "media:";
export const DEFAULT_MAX_MEDIA_ASSET_BYTES = 25 * 1024 * 1024;

export const DEFAULT_ALLOWED_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/heic",
  "image/heif",
  "audio/mpeg",
  "audio/mp4",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "video/quicktime",
  "application/pdf",
] as const;

export type MediaAssetRole = "photo" | "attachment";

export interface MediaAssetRecord {
  version: typeof MEDIA_ASSET_RECORD_VERSION;
  id: string;
  personId: string;
  role: MediaAssetRole;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMediaAssetInput {
  id?: string;
  personId: string;
  role: MediaAssetRole;
  name: string;
  blob: Blob;
  createdAt?: string;
  updatedAt?: string;
}

export interface MediaAssetValidationOptions {
  maxAssetBytes?: number;
  allowedMimeTypes?: readonly string[];
}

export type MediaAssetValidationErrorCode =
  | "INVALID_MEDIA_ASSET"
  | "UNSAFE_MEDIA_TYPE"
  | "MEDIA_ASSET_TOO_LARGE";

export class MediaAssetValidationError extends Error {
  readonly code: MediaAssetValidationErrorCode;

  constructor(code: MediaAssetValidationErrorCode, message: string) {
    super(message);
    this.name = "MediaAssetValidationError";
    this.code = code;
  }
}

function createMediaAssetId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `asset-${globalThis.crypto.randomUUID()}`;
  }

  return `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function assertCanonicalIdentifier(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 256 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      `${label} must be a non-empty canonical identifier.`,
    );
  }
}

function assertSafeName(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > 255 ||
    value !== value.trim() ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      "Media asset name must be between 1 and 255 safe characters.",
    );
  }
}

function assertTimestamp(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    Number.isNaN(Date.parse(value))
  ) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      `${label} must be a valid timestamp.`,
    );
  }
}

function assertBlob(value: unknown): asserts value is Blob {
  if (typeof Blob === "undefined" || !(value instanceof Blob)) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      "Media asset blob is missing or invalid.",
    );
  }
}

function resolveMaxAssetBytes(options?: MediaAssetValidationOptions): number {
  const maxAssetBytes = options?.maxAssetBytes ?? DEFAULT_MAX_MEDIA_ASSET_BYTES;

  if (!Number.isSafeInteger(maxAssetBytes) || maxAssetBytes <= 0) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      "Maximum media asset size must be a positive safe integer.",
    );
  }

  return maxAssetBytes;
}

export function validateMediaAssetRecord(
  record: MediaAssetRecord,
  options?: MediaAssetValidationOptions,
): MediaAssetRecord {
  if (!record || typeof record !== "object") {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      "Media asset record is missing or invalid.",
    );
  }

  if (record.version !== MEDIA_ASSET_RECORD_VERSION) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      `Unsupported media asset record version: ${String(record.version)}.`,
    );
  }

  assertCanonicalIdentifier(record.id, "Media asset id");
  assertCanonicalIdentifier(record.personId, "Media asset personId");
  assertSafeName(record.name);
  assertTimestamp(record.createdAt, "Media asset createdAt");
  assertTimestamp(record.updatedAt, "Media asset updatedAt");
  assertBlob(record.blob);

  if (record.role !== "photo" && record.role !== "attachment") {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      `Unsupported media asset role: ${String(record.role)}.`,
    );
  }

  const mimeType = record.mimeType.trim().toLowerCase();
  const allowedMimeTypes =
    options?.allowedMimeTypes ?? DEFAULT_ALLOWED_MEDIA_MIME_TYPES;

  if (
    mimeType !== record.mimeType ||
    record.blob.type.toLowerCase() !== mimeType ||
    !allowedMimeTypes.includes(mimeType)
  ) {
    throw new MediaAssetValidationError(
      "UNSAFE_MEDIA_TYPE",
      `Media type is not allowed: ${record.mimeType || "unknown"}.`,
    );
  }

  if (
    !Number.isSafeInteger(record.size) ||
    record.size <= 0 ||
    record.size !== record.blob.size
  ) {
    throw new MediaAssetValidationError(
      "INVALID_MEDIA_ASSET",
      "Media asset size does not match its Blob.",
    );
  }

  const maxAssetBytes = resolveMaxAssetBytes(options);
  if (record.size > maxAssetBytes) {
    throw new MediaAssetValidationError(
      "MEDIA_ASSET_TOO_LARGE",
      `Media asset exceeds the ${maxAssetBytes}-byte limit.`,
    );
  }

  return record;
}

export function createMediaAssetRecord(
  input: CreateMediaAssetInput,
  options?: MediaAssetValidationOptions,
): MediaAssetRecord {
  assertBlob(input.blob);

  const now = new Date().toISOString();
  const record: MediaAssetRecord = {
    version: MEDIA_ASSET_RECORD_VERSION,
    id: input.id?.trim() || createMediaAssetId(),
    personId: input.personId.trim(),
    role: input.role,
    name: input.name.trim(),
    mimeType: input.blob.type.trim().toLowerCase(),
    size: input.blob.size,
    blob: input.blob,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };

  return validateMediaAssetRecord(record, options);
}

export function createMediaAssetReference(assetId: string): string {
  assertCanonicalIdentifier(assetId, "Media asset id");
  return `${MEDIA_ASSET_REFERENCE_PREFIX}${encodeURIComponent(assetId)}`;
}

export function parseMediaAssetReference(value: string | null | undefined): string | null {
  if (!value?.startsWith(MEDIA_ASSET_REFERENCE_PREFIX)) {
    return null;
  }

  try {
    const assetId = decodeURIComponent(value.slice(MEDIA_ASSET_REFERENCE_PREFIX.length));
    assertCanonicalIdentifier(assetId, "Media asset id");
    return assetId;
  } catch {
    return null;
  }
}
