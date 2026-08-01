import {
  inspectOfflineArtifact,
  offlineArtifactPath,
} from "./offline-artifact.mjs";

const result = await inspectOfflineArtifact();

console.log(`Verified: ${offlineArtifactPath}`);
console.log(`Size: ${result.bytes} bytes`);
console.log(`Multimedia files: ${result.multimediaFileCount}`);
console.log(`Bundled multimedia: ${result.bundledMultimediaCount}`);
console.log(`SHA-256: ${result.sha256}`);
