import embeddedDemoMedia from "virtual:embedded-demo-media";

const installationKey = Symbol.for("family-tree.embedded-demo-media-fetch");

function getEmbeddedPath(input: RequestInfo | URL): string | null {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;

  if (rawUrl.startsWith("/demo-media/")) {
    return rawUrl;
  }

  try {
    const url = new URL(rawUrl, window.location.href);
    return url.pathname.startsWith("/demo-media/") ? url.pathname : null;
  } catch {
    return null;
  }
}

function decodeBase64(base64: string): Uint8Array {
  const binary = window.atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function installEmbeddedDemoMediaFetch(): void {
  const globalState = window as typeof window & {
    [installationKey]?: boolean;
  };

  if (globalState[installationKey]) {
    return;
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const path = getEmbeddedPath(input);
    const media = path ? embeddedDemoMedia[path] : undefined;

    if (!media) {
      return nativeFetch(input, init);
    }

    const method =
      init?.method ??
      (typeof input === "object" && "method" in input ? input.method : "GET");
    if (method.toUpperCase() !== "GET") {
      return Promise.resolve(
        new Response(null, {
          status: 405,
          statusText: "Method Not Allowed",
        }),
      );
    }

    const bytes = decodeBase64(media.base64);
    const body = new Blob([bytes], { type: media.mimeType });

    return Promise.resolve(
      new Response(body, {
        headers: {
          "Content-Length": String(bytes.byteLength),
          "Content-Type": media.mimeType,
        },
        status: 200,
      }),
    );
  };
  globalState[installationKey] = true;
}
