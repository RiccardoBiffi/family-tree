import {
  inspectOfflineArtifact,
  offlineArtifactPath,
} from "./offline-artifact.mjs";

const result = await inspectOfflineArtifact();

console.log(`Verified: ${offlineArtifactPath}`);
console.log(`Size: ${result.bytes} bytes`);
console.log(`Embedded demo media: ${result.demoMediaCount}`);
console.log(`SHA-256: ${result.sha256}`);
