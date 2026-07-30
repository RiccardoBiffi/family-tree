import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/postcss";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const demoMediaRoot = resolve(projectRoot, "public/demo-media");
const virtualModuleId = "virtual:embedded-demo-media";
const resolvedVirtualModuleId = `\0${virtualModuleId}`;
const expectedDemoMediaCount = 20;

const mimeTypeByExtension: Readonly<Record<string, string>> = {
  ".wav": "audio/wav",
  ".webp": "image/webp",
};

function listFiles(directory: string): string[] {
  return readdirSync(directory)
    .sort((left, right) => left.localeCompare(right))
    .flatMap((entry) => {
      const absolutePath = join(directory, entry);
      return statSync(absolutePath).isDirectory()
        ? listFiles(absolutePath)
        : [absolutePath];
    });
}

function createEmbeddedDemoMediaPlugin(): Plugin {
  return {
    name: "embedded-demo-media",
    resolveId(id) {
      return id === virtualModuleId ? resolvedVirtualModuleId : null;
    },
    load(id) {
      if (id !== resolvedVirtualModuleId) {
        return null;
      }

      const files = listFiles(demoMediaRoot);
      if (files.length !== expectedDemoMediaCount) {
        throw new Error(
          `Expected ${expectedDemoMediaCount} demo media files, found ${files.length}.`,
        );
      }

      const media = Object.fromEntries(
        files.map((absolutePath) => {
          const extension = extname(absolutePath).toLowerCase();
          const mimeType = mimeTypeByExtension[extension];
          if (!mimeType) {
            throw new Error(
              `Unsupported demo media extension: ${extension || "(none)"}.`,
            );
          }

          const relativePath = relative(demoMediaRoot, absolutePath)
            .split(sep)
            .join("/");
          return [
            `/demo-media/${relativePath}`,
            {
              base64: readFileSync(absolutePath).toString("base64"),
              mimeType,
            },
          ];
        }),
      );

      return `export default Object.freeze(${JSON.stringify(media)});`;
    },
  };
}

export default defineConfig({
  root: resolve(projectRoot, "offline"),
  publicDir: false,
  plugins: [
    createEmbeddedDemoMediaPlugin(),
    react(),
    viteSingleFile({
      removeViteModuleLoader: true,
      useRecommendedBuildConfig: true,
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(projectRoot, "src"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  build: {
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    cssCodeSplit: false,
    emptyOutDir: true,
    minify: "esbuild",
    outDir: resolve(projectRoot, "dist-offline"),
    sourcemap: false,
    target: "es2020",
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
