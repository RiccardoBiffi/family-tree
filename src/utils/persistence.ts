export type PersistenceStatus = "durable" | "volatile";

const capabilityErrorNames = new Set([
  "InvalidStateError",
  "MediaDBUnavailableError",
  "NotSupportedError",
  "QuotaExceededError",
  "SecurityError",
]);

export function isPersistenceCapabilityError(error: unknown): boolean {
  if (
    (typeof error !== "object" && typeof error !== "function") ||
    error === null ||
    !("name" in error)
  ) {
    return false;
  }

  return capabilityErrorNames.has(String(error.name));
}
