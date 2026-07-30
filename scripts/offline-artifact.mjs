import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);

export const offlineOutputDirectory = resolve(projectRoot, "dist-offline");
export const offlineArtifactPath = resolve(
  offlineOutputDirectory,
  "archivio-famiglia.html",
);
export const expectedDemoMediaCount = 20;
export const maximumOfflineArtifactBytes = 8 * 1024 * 1024;

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const absolutePath = resolve(directory, entry.name);
      return entry.isDirectory() ? listFiles(absolutePath) : [absolutePath];
    }),
  );
  return nestedFiles.flat().sort();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export async function inspectOfflineArtifact() {
  const files = await listFiles(offlineOutputDirectory);
  assert(
    files.length === 1 && files[0] === offlineArtifactPath,
    `Expected exactly ${offlineArtifactPath}; found ${files.join(", ") || "no files"}.`,
  );

  const artifactStats = await stat(offlineArtifactPath);
  assert(
    artifactStats.size <= maximumOfflineArtifactBytes,
    `Offline artifact is ${artifactStats.size} bytes; limit is ${maximumOfflineArtifactBytes}.`,
  );

  const html = await readFile(offlineArtifactPath, "utf8");
  assert(
    /Content-Security-Policy/iu.test(html) &&
      /connect-src\s+'none'/iu.test(html),
    "Offline artifact must include a CSP that blocks network connections.",
  );
  assert(
    !/<script\b[^>]*\bsrc\s*=/iu.test(html),
    "Offline artifact contains an external script reference.",
  );
  assert(
    !/<link\b[^>]*\brel=["']?stylesheet/iu.test(html),
    "Offline artifact contains an external stylesheet reference.",
  );
  assert(
    !/(?:src|href|poster)\s*=\s*["']https?:\/\//iu.test(html),
    "Offline artifact contains a network-backed HTML resource.",
  );
  assert(
    !/url\(\s*["']?https?:\/\//iu.test(html),
    "Offline artifact contains a network-backed CSS resource.",
  );
  assert(
    !/sourceMappingURL=/u.test(html),
    "Offline artifact contains a source map reference.",
  );

  const embeddedPaths = new Set(
    html.match(
      /\/demo-media\/(?:audio|portraits)\/[a-z0-9-]+\.(?:wav|webp)/gu,
    ) ?? [],
  );
  assert(
    embeddedPaths.size === expectedDemoMediaCount,
    `Expected ${expectedDemoMediaCount} embedded demo media paths; found ${embeddedPaths.size}.`,
  );

  return {
    bytes: artifactStats.size,
    demoMediaCount: embeddedPaths.size,
    sha256: createHash("sha256").update(html).digest("hex"),
  };
}
