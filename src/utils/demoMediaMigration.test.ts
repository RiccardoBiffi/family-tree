import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEMO_MEDIA_MIGRATION_STORAGE_KEY,
  hasCompletedDemoMediaMigration,
  markDemoMediaMigrationComplete,
} from "@/utils/demoMediaMigration";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.removeItem(DEMO_MEDIA_MIGRATION_STORAGE_KEY);
});

describe("demo media migration persistence", () => {
  it("treats a denied localStorage getter as unavailable", () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Access denied.", "SecurityError");
      },
    });

    try {
      expect(hasCompletedDemoMediaMigration()).toBe(false);
      expect(() => markDemoMediaMigrationComplete()).not.toThrow();
    } finally {
      if (descriptor) {
        Object.defineProperty(window, "localStorage", descriptor);
      }
    }
  });

  it("ignores capability failures from migration reads and writes", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Access denied.", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Quota exhausted.", "QuotaExceededError");
    });

    expect(hasCompletedDemoMediaMigration()).toBe(false);
    expect(() => markDemoMediaMigrationComplete()).not.toThrow();
  });

  it("does not hide unexpected migration storage errors", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Unexpected read failure.");
    });

    expect(() => hasCompletedDemoMediaMigration()).toThrow(
      "Unexpected read failure.",
    );
  });
});
