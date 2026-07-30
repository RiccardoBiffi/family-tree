import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import AxeBuilder from "@axe-core/playwright";
import { chromium } from "playwright";

import {
  inspectOfflineArtifact,
  offlineArtifactPath,
} from "./offline-artifact.mjs";

const allowedProtocols = new Set(["blob:", "data:", "file:"]);
const artifactUrl = pathToFileURL(offlineArtifactPath).href;
const archiveHeading = "Archivio Verifica Offline";
const personName = "Ada Offline";
const childName = "Grace Archivio";
const pngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Xw4Z7QAAAABJRU5ErkJggg==",
  "base64",
);
const pdfBytes = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
);
const videoBytes = Buffer.from([
  0, 0, 0, 20, 102, 116, 121, 112, 105, 115, 111, 109,
]);
const demoAudioBytes = await readFile(
  new URL(
    "../public/demo-media/audio/cartolina-anna-conti.wav",
    import.meta.url,
  ),
);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function observeRuntime(page, label) {
  const runtimeErrors = [];
  const networkRequests = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      runtimeErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    runtimeErrors.push(error.message);
  });
  page.on("request", (request) => {
    const protocol = new URL(request.url()).protocol;
    if (!allowedProtocols.has(protocol)) {
      networkRequests.push(request.url());
    }
  });

  return () => {
    assert(
      runtimeErrors.length === 0,
      `${label}: console/page errors: ${runtimeErrors.join(" | ")}`,
    );
    assert(
      networkRequests.length === 0,
      `${label}: network requests: ${networkRequests.join(", ")}`,
    );
  };
}

async function assertNoPageOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  assert(
    dimensions.scrollWidth <= dimensions.clientWidth,
    `${label}: page overflows horizontally (${dimensions.scrollWidth}px > ${dimensions.clientWidth}px).`,
  );
}

async function assertNoSeriousAxeFindings(page, label) {
  const results = await new AxeBuilder({ page }).analyze();
  const findings = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );

  assert(
    findings.length === 0,
    `${label}: serious/critical axe findings: ${findings
      .map((finding) => `${finding.id} (${finding.nodes.length})`)
      .join(", ")}`,
  );
}

async function initializeArchive(page, familyName = "Verifica Offline") {
  await page.goto(artifactUrl);
  await page
    .getByRole("heading", { name: "Crea il tuo archivio di famiglia" })
    .waitFor();
  await page.getByLabel("Nome della famiglia").fill(familyName);
  await page.getByRole("button", { name: "Crea l'archivio" }).click();
  await page
    .getByRole("heading", { name: `Archivio ${familyName}` })
    .waitFor();
}

async function assertVisitor(page, label, heading = archiveHeading) {
  await page.getByRole("heading", { name: heading }).waitFor();
  await page.getByRole("toolbar", { name: "Azioni archivio" }).waitFor();
  await page.getByRole("button", { name: "Gestisci archivio" }).waitFor();
  assert(
    (await page.getByRole("button", { name: "Nuova persona" }).count()) === 0,
    `${label}: visitor exposed person creation.`,
  );
  assert(
    (await page.getByRole("button", { name: /modifica|elimina/i }).count()) === 0,
    `${label}: visitor exposed mutation controls.`,
  );
}

async function assertAdmin(page) {
  await page.getByRole("toolbar", { name: "Azioni archivio" }).waitFor();
  await page.getByRole("button", { name: "Nuova persona" }).waitFor();
}

async function openCreatePerson(page) {
  await page.getByRole("button", { name: "Nuova persona" }).click();
  return page.getByRole("dialog", { name: "Crea una nuova scheda" });
}

async function createAdultWithMedia(page) {
  const editor = await openCreatePerson(page);
  await editor.getByRole("textbox", { exact: true, name: "Nome" }).fill("Ada");
  await editor.getByRole("textbox", { exact: true, name: "Cognome" }).fill("Offline");
  await editor.getByLabel("Data di nascita").fill("1980-01-02");
  await editor.getByLabel("Professione").fill("Archivista");
  await editor.getByLabel("Seleziona foto").setInputFiles({
    buffer: pngBytes,
    mimeType: "image/png",
    name: "ritratto-ada.png",
  });
  await editor.getByLabel("Aggiungi contenuti multimediali").setInputFiles([
    {
      buffer: pngBytes,
      mimeType: "image/png",
      name: "ricordo-ada.png",
    },
    {
      buffer: demoAudioBytes,
      mimeType: "audio/wav",
      name: "voce-ada.wav",
    },
    {
      buffer: videoBytes,
      mimeType: "video/mp4",
      name: "filmato-ada.mp4",
    },
    {
      buffer: pdfBytes,
      mimeType: "application/pdf",
      name: "documento-ada.pdf",
    },
  ]);
  await editor.getByRole("button", { name: "Crea persona" }).click();

  const details = page.getByRole("dialog", { name: personName });
  await details.waitFor();
  await details.getByText("Contenuti multimediali").waitFor();
  for (const fileName of [
    "ricordo-ada.png",
    "voce-ada.wav",
    "filmato-ada.mp4",
    "documento-ada.pdf",
  ]) {
    await details.getByText(fileName).waitFor();
  }
  await page.keyboard.press("Escape");
}

async function createChildWithParent(page) {
  const editor = await openCreatePerson(page);
  await editor.getByRole("textbox", { exact: true, name: "Nome" }).fill("Grace");
  await editor.getByRole("textbox", { exact: true, name: "Cognome" }).fill("Archivio");
  await editor.getByLabel("Data di nascita").fill("2012-03-04");
  await editor.getByRole("button", { name: "Genitori" }).click();
  await editor.getByLabel(personName).check();
  await editor.getByRole("button", { name: "Genitori" }).click();
  await editor.getByRole("button", { name: "Crea persona" }).click();

  const details = page.getByRole("dialog", { name: childName });
  await details.waitFor();
  await details.getByText("Ada", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
}

async function exportArchive(page, downloadDirectory) {
  await page.getByRole("button", { name: "Gestisci archivio" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Esporta archivio" }).click();
  const download = await downloadPromise;
  const path = join(downloadDirectory, download.suggestedFilename());
  await download.saveAs(path);
  assert(path.endsWith(".albero"), "Export did not produce a .albero file.");
  assert((await readFile(path)).byteLength > 0, "Exported .albero is empty.");
  return path;
}

async function importArchive(page, archiveInput) {
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Seleziona archivio da importare")
    .setInputFiles(archiveInput);
  await page
    .getByRole("status")
    .filter({ hasText: "Archivio importato." })
    .waitFor();
}

async function getMediaManifest(page) {
  const records = await page.evaluate(
    async ({ databaseName, storeName }) =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const database = request.result;
          const transaction = database.transaction(storeName, "readonly");
          const getAllRequest = transaction.objectStore(storeName).getAll();
          getAllRequest.onerror = () => reject(getAllRequest.error);
          getAllRequest.onsuccess = async () => {
            const manifests = await Promise.all(
              getAllRequest.result.map(async (record) => ({
                bytes: Array.from(new Uint8Array(await record.blob.arrayBuffer())),
                mimeType: record.mimeType,
                name: record.name,
                role: record.role,
              })),
            );
            database.close();
            resolve(manifests);
          };
        };
      }),
    {
      databaseName: "family-tree.media.v1",
      storeName: "assets",
    },
  );

  return records
    .map((record) => ({
      mimeType: record.mimeType,
      name: record.name,
      role: record.role,
      sha256: createHash("sha256").update(Buffer.from(record.bytes)).digest("hex"),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function runDurableDesktopFlow(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1440 },
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const assertCleanRuntime = observeRuntime(page, "desktop durable");
  const downloadDirectory = await mkdtemp(
    join(tmpdir(), "family-tree-offline-"),
  );

  try {
    await initializeArchive(page);
    await assertVisitor(page, "desktop default");
    await assertNoPageOverflow(page, "desktop default");

    for (const viewName of ["Diagramma", "Tabella", "Timeline"]) {
      await page.getByRole("tab", { exact: true, name: viewName }).click();
    }

    for (const query of ["?foo", "?administrator"]) {
      await page.goto(`${artifactUrl}${query}`);
      await assertVisitor(page, `desktop ${query}`);
    }

    for (const query of ["?admin", "?admin="]) {
      await page.goto(`${artifactUrl}${query}`);
      await assertAdmin(page);
    }

    await createAdultWithMedia(page);
    await createChildWithParent(page);
    const originalMediaManifest = await getMediaManifest(page);

    await page.reload();
    await assertAdmin(page);
    await page.getByLabel("Cerca una persona").fill("Grace");
    await page.getByRole("button", { name: new RegExp(childName) }).click();
    const persistedChild = page.getByRole("dialog", { name: childName });
    await persistedChild.getByText("Ada", { exact: true }).waitFor();
    await page.keyboard.press("Escape");

    await page.goto(artifactUrl);
    await assertVisitor(page, "desktop durable reload");
    await page.getByLabel("Cerca una persona").fill("Ada");
    await page.getByRole("button", { name: new RegExp(personName) }).click();
    const persistedAdult = page.getByRole("dialog", { name: personName });
    await persistedAdult.getByText("voce-ada.wav").waitFor();
    await page.keyboard.press("Escape");
    const exportedPath = await exportArchive(page, downloadDirectory);

    await page.goto(`${artifactUrl}?admin`);
    await page.getByLabel("Cerca una persona").fill("Grace");
    await page.getByRole("button", { name: new RegExp(childName) }).click();
    await page.getByRole("button", { name: "Modifica" }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Elimina" }).click();
    await page.getByRole("button", { name: new RegExp(childName) }).waitFor({
      state: "detached",
    });

    await page.goto(artifactUrl);
    await assertVisitor(page, "desktop visitor import");
    await importArchive(page, exportedPath);
    await page.getByLabel("Cerca una persona").fill("Grace");
    await page.getByRole("button", { name: new RegExp(childName) }).waitFor();
    assert(
      JSON.stringify(await getMediaManifest(page)) ===
        JSON.stringify(originalMediaManifest),
      "Media hashes changed after the .albero round-trip.",
    );

    await assertNoSeriousAxeFindings(page, "desktop visitor archive transfer");
    await assertNoPageOverflow(page, "desktop admin");
    assertCleanRuntime();
  } finally {
    await context.close();
    await rm(downloadDirectory, { force: true, recursive: true });
  }

  console.log(
    "desktop acceptance: admin CRUD plus visitor .albero export/import and media hashes verified.",
  );
}

async function runMobileFlow(browser) {
  const context = await browser.newContext({
    viewport: { height: 844, width: 390 },
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const assertCleanRuntime = observeRuntime(page, "mobile");

  try {
    await initializeArchive(page);
    await assertVisitor(page, "mobile default");

    for (const viewName of ["Diagramma", "Tabella", "Timeline"]) {
      await page.getByRole("tab", { exact: true, name: viewName }).click();
      await assertNoPageOverflow(page, `mobile ${viewName}`);
    }

    await assertNoSeriousAxeFindings(page, "mobile visitor");
    assertCleanRuntime();
  } finally {
    await context.close();
  }

  console.log(
    "mobile acceptance: views, zero overflow, axe and offline request policy verified.",
  );
}

async function runEmbeddedDemoMediaFlow(browser) {
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const assertCleanRuntime = observeRuntime(page, "embedded demo media");

  try {
    await page.goto(artifactUrl);
    await page.evaluate(() => {
      localStorage.setItem("family-tree.snapshot.v1", "{malformed");
    });
    await page.reload();
    await page.getByRole("heading", { name: "Archivio Rinaldi" }).waitFor();
    await page
      .getByRole("button", { name: /Giovanni Rinaldi/ })
      .first()
      .click();

    const details = page.getByRole("dialog", { name: /Giovanni Rinaldi/ });
    const portrait = details.getByRole("img", {
      name: /Giovanni Rinaldi/,
    });
    const audio = details.getByLabel(
      "Cartolina sonora di Giovanni Rinaldi.wav",
    );
    await portrait.waitFor();
    await audio.waitFor();
    const mediaState = await page.evaluate(
      ({ audioLabel, portraitLabel }) => {
        const image = document.querySelector(
          `img[alt="${portraitLabel}"]`,
        );
        const audioElement = document.querySelector(
          `audio[aria-label="${audioLabel}"]`,
        );
        return {
          audioSource: audioElement?.getAttribute("src") ?? "",
          imageComplete:
            image instanceof HTMLImageElement &&
            image.complete &&
            image.naturalWidth > 0,
          imageSource: image?.getAttribute("src") ?? "",
        };
      },
      {
        audioLabel: "Cartolina sonora di Giovanni Rinaldi.wav",
        portraitLabel: "Nanni (Giovanni Rinaldi)",
      },
    );
    assert(mediaState.imageComplete, "Embedded demo portrait did not decode.");
    assert(
      mediaState.imageSource.startsWith("blob:") &&
        mediaState.audioSource.startsWith("blob:"),
      "Embedded demo media did not resolve to local blob URLs.",
    );
    const manifest = await getMediaManifest(page);
    assert(manifest.length === 20, `Expected 20 demo media records, found ${manifest.length}.`);
    assertCleanRuntime();
  } finally {
    await context.close();
  }

  console.log("demo media acceptance: all 20 embedded records seeded and portrait/audio resolve offline.");
}

async function runVolatileFlow(browser) {
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { height: 900, width: 1440 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Blocked for offline QA.", "SecurityError");
      },
    });
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get() {
        throw new DOMException("Blocked for offline QA.", "SecurityError");
      },
    });
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const assertCleanRuntime = observeRuntime(page, "volatile");
  const downloadDirectory = await mkdtemp(
    join(tmpdir(), "family-tree-volatile-"),
  );

  let exportedArchive;
  try {
    await page.goto(`${artifactUrl}?admin`);
    await page
      .getByRole("heading", { name: "Crea il tuo archivio di famiglia" })
      .waitFor();
    await page.getByLabel("Nome della famiglia").fill("Volatile");
    await page.getByRole("button", { name: "Crea l'archivio" }).click();
    await page.getByRole("heading", { name: "Archivio Volatile" }).waitFor();
    await page
      .getByRole("status")
      .filter({ hasText: "Archiviazione temporanea" })
      .waitFor();

    const editor = await openCreatePerson(page);
    await editor.getByRole("textbox", { exact: true, name: "Nome" }).fill("Sessione");
    await editor.getByRole("textbox", { exact: true, name: "Cognome" }).fill("Temporanea");
    await editor.getByLabel("Seleziona foto").setInputFiles({
      buffer: pngBytes,
      mimeType: "image/png",
      name: "sessione.png",
    });
    await editor.getByRole("button", { name: "Crea persona" }).click();
    await page.getByRole("dialog", { name: "Sessione Temporanea" }).waitFor();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: /Sessione Temporanea/ }).waitFor();
    const exportedPath = await exportArchive(page, downloadDirectory);
    exportedArchive = await readFile(exportedPath);
    assertCleanRuntime();
  } finally {
    await context.close();
    await rm(downloadDirectory, { force: true, recursive: true });
  }

  assert(exportedArchive, "Volatile archive export was not captured.");
  console.log(
    "volatile acceptance: denied storage degrades safely, preserves in-session CRUD and exposes export.",
  );
  return exportedArchive;
}

async function runVolatileRecoveryFlow(browser, archiveBytes) {
  const context = await browser.newContext({
    viewport: { height: 900, width: 1440 },
  });
  await context.setOffline(true);
  const page = await context.newPage();
  const assertCleanRuntime = observeRuntime(page, "volatile recovery");

  try {
    await initializeArchive(page, "Ricezione");
    await page.goto(`${artifactUrl}?admin`);
    await importArchive(page, {
      buffer: archiveBytes,
      mimeType: "application/vnd.family-tree.albero",
      name: "recupero-volatile.albero",
    });
    await page.getByRole("heading", { name: "Archivio Volatile" }).waitFor();
    await page.getByLabel("Cerca una persona").fill("Sessione");
    await page.getByRole("button", { name: /Sessione Temporanea/ }).click();
    const details = page.getByRole("dialog", { name: "Sessione Temporanea" });
    await details.locator("img").waitFor();
    await page.keyboard.press("Escape");

    await page.reload();
    await page.getByRole("heading", { name: "Archivio Volatile" }).waitFor();
    await page.getByRole("button", { name: /Sessione Temporanea/ }).waitFor();
    const manifest = await getMediaManifest(page);
    assert(
      manifest.some(
        (asset) =>
          asset.name === "sessione.png" &&
          asset.sha256 === createHash("sha256").update(pngBytes).digest("hex"),
      ),
      "Recovered volatile photo hash does not match the exported media.",
    );
    assertCleanRuntime();
  } finally {
    await context.close();
  }

  console.log(
    "volatile recovery: .albero restored data and media hashes into fresh durable storage.",
  );
}

await inspectOfflineArtifact();
const browser = await chromium.launch({ headless: true });

try {
  await runDurableDesktopFlow(browser);
  await runMobileFlow(browser);
  await runEmbeddedDemoMediaFlow(browser);
  const volatileArchive = await runVolatileFlow(browser);
  await runVolatileRecoveryFlow(browser, volatileArchive);
} finally {
  await browser.close();
}
