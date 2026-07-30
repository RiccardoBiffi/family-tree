import { rename } from "node:fs/promises";
import { resolve } from "node:path";

import {
  inspectOfflineArtifact,
  offlineArtifactPath,
  offlineOutputDirectory,
} from "./offline-artifact.mjs";

const viteOutputPath = resolve(offlineOutputDirectory, "index.html");

await rename(viteOutputPath, offlineArtifactPath);
const result = await inspectOfflineArtifact();

console.log(`Offline artifact: ${offlineArtifactPath}`);
console.log(`Size: ${result.bytes} bytes`);
console.log(`Embedded demo media: ${result.demoMediaCount}`);
console.log(`SHA-256: ${result.sha256}`);
