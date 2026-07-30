import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  inspectOfflineArtifact,
  offlineArtifactPath,
} from "./offline-artifact.mjs";

const viewports = [
  { height: 900, label: "desktop", width: 1440 },
  { height: 844, label: "mobile", width: 390 },
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

await inspectOfflineArtifact();

const browser = await chromium.launch({ headless: true });
const artifactUrl = pathToFileURL(offlineArtifactPath).href;

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({
      viewport: { height: viewport.height, width: viewport.width },
    });
    await context.setOffline(true);
    const page = await context.newPage();
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
      if (!["blob:", "data:", "file:"].includes(protocol)) {
        networkRequests.push(request.url());
      }
    });

    await page.goto(artifactUrl);
    await page.getByRole("heading", {
      name: "Crea il tuo archivio di famiglia",
    }).waitFor();
    await page.getByLabel("Nome della famiglia").fill("Verifica Offline");
    await page.getByRole("button", { name: "Crea l'archivio" }).click();
    await page.getByRole("heading", { name: "Archivio Verifica Offline" }).waitFor();

    await page.getByRole("toolbar", { name: "Azioni archivio" }).waitFor();
    await page.getByRole("button", { name: "Gestisci archivio" }).waitFor();
    assert(
      (await page.getByRole("button", { name: "Nuova persona" }).count()) === 0,
      `${viewport.label}: visitor exposed person creation.`,
    );

    for (const viewName of ["Diagramma", "Tabella", "Timeline"]) {
      await page.getByRole("tab", { exact: true, name: viewName }).click();
    }

    for (const query of ["?foo", "?administrator"]) {
      await page.goto(`${artifactUrl}${query}`);
      await page.getByRole("heading", { name: "Archivio Verifica Offline" }).waitFor();
      await page.getByRole("button", { name: "Gestisci archivio" }).waitFor();
      assert(
        (await page.getByRole("button", { name: "Nuova persona" }).count()) ===
          0,
        `${viewport.label}: ${query} incorrectly exposed admin mutation.`,
      );
    }

    for (const query of ["?admin", "?admin="]) {
      await page.goto(`${artifactUrl}${query}`);
      await page.getByRole("toolbar", { name: "Azioni archivio" }).waitFor();
      await page.getByRole("button", { name: "Nuova persona" }).waitFor();
    }

    assert(
      runtimeErrors.length === 0,
      `${viewport.label}: console/page errors: ${runtimeErrors.join(" | ")}`,
    );
    assert(
      networkRequests.length === 0,
      `${viewport.label}: network requests: ${networkRequests.join(", ")}`,
    );

    await context.close();
    console.log(
      `${viewport.label}: visitor/admin query routing and offline request policy verified.`,
    );
  }
} finally {
  await browser.close();
}
