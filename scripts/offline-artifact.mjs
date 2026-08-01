import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
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
export const maximumOfflineArtifactBytes = 8 * 1024 * 1024;
const multimediaExtensions = new Set([
  ".aac",
  ".avif",
  ".bmp",
  ".flac",
  ".gif",
  ".heic",
  ".heif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".m4a",
  ".mkv",
  ".mov",
  ".mp3",
  ".mp4",
  ".ogg",
  ".pdf",
  ".png",
  ".svg",
  ".tif",
  ".tiff",
  ".wav",
  ".webm",
  ".webp",
]);

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

export function findBundledMultimediaReferences(html) {
  const srcsetReferences = Array.from(
    html.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/giu),
    (match) => match[1],
  ).flatMap((srcset) =>
    srcset.split(",").map((candidate) => candidate.trim().split(/\s+/u, 1)[0]),
  );
  const resourceReferences = [
    ...Array.from(
      html.matchAll(
        /\b(?:src|href|poster|data)\s*=\s*["']([^"']+)["']/giu,
      ),
      (match) => match[1],
    ),
    ...srcsetReferences,
    ...Array.from(
      html.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/giu),
      (match) => match[1],
    ),
  ];

  return Array.from(
    new Set(
      resourceReferences.filter((reference) => {
        const normalized = reference.trim().toLowerCase();
        if (
          /^data:(?:(?:image|audio|video)\/|application\/pdf(?:[;,]|$))/u.test(
            normalized,
          )
        ) {
          return true;
        }

        const path = normalized.split(/[?#]/u, 1)[0];
        return (
          path.includes("/demo-media/") ||
          multimediaExtensions.has(extname(path))
        );
      }),
    ),
  ).sort();
}

export async function inspectOfflineArtifact() {
  const files = await listFiles(offlineOutputDirectory);
  assert(
    files.length === 1 && files[0] === offlineArtifactPath,
    `Expected exactly ${offlineArtifactPath}; found ${files.join(", ") || "no files"}.`,
  );
  const multimediaFiles = files.filter((file) =>
    multimediaExtensions.has(extname(file).toLowerCase()),
  );
  assert(
    multimediaFiles.length === 0,
    `Offline output contains multimedia files: ${multimediaFiles.join(", ")}.`,
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

  const bundledMediaReferences = findBundledMultimediaReferences(html);
  assert(
    bundledMediaReferences.length === 0,
    `Expected zero bundled multimedia references; found ${bundledMediaReferences.join(", ")}.`,
  );

  return {
    bytes: artifactStats.size,
    bundledMultimediaCount: bundledMediaReferences.length,
    multimediaFileCount: multimediaFiles.length,
    sha256: createHash("sha256").update(html).digest("hex"),
  };
}
