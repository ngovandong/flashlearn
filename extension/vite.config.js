import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig, transformWithOxc } from "vite";

import manifest from "./manifest.json" with { type: "json" };

export default defineConfig(({ command, mode }) => ({
  plugins: [
    {
      name: "flashlearn-extension-js-as-jsx",
      enforce: "pre",
      async transform(code, id) {
        if (!id.includes("/src/") || !id.split("?")[0].endsWith(".js")) {
          return null;
        }
        return transformWithOxc(code, id, {
          lang: "jsx",
          jsx: {
            runtime: "automatic",
            development: command === "serve" && mode !== "test",
            refresh: command === "serve" && mode !== "test",
          },
        });
      },
    },
    react({ include: /\.(js|jsx|ts|tsx)$/ }),
    crx({ manifest }),
  ],
  build: {
    outDir: "build",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.js"],
  },
}));
