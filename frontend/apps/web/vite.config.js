import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, transformWithOxc } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const fromRoot = (...parts) => path.resolve(rootDir, ...parts);

export default defineConfig(({ command }) => ({
  plugins: [
    {
      name: "flashlearn-js-as-jsx",
      enforce: "pre",
      async transform(code, id) {
        if (!id.includes("/src/") || !id.split("?")[0].endsWith(".js")) {
          return null;
        }
        return transformWithOxc(code, id, {
          lang: "jsx",
          jsx: {
            runtime: "automatic",
            development: command === "serve",
            refresh: command === "serve",
          },
        });
      },
    },
    react({ include: /\.(js|jsx|ts|tsx)$/ }),
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@components": fromRoot("src/components"),
      "@utils": fromRoot("src/utils"),
      "@styles": fromRoot("src/styles"),
      "@constants": fromRoot("src/constants"),
      "@app": fromRoot("src/app"),
      "@pages": fromRoot("src/pages"),
      "@api-services": fromRoot("src/api-service"),
      "@hooks": fromRoot("src/hooks"),
      "@flashlearn/core": fromRoot("../../packages/core/src/index.ts"),
      "@flashlearn/api": fromRoot("../../packages/api/src/index.ts"),
      "@flashlearn/auth": fromRoot("../../packages/auth/src/index.ts"),
    },
  },
  optimizeDeps: {
    entries: ["index.html"],
    rolldownOptions: {
      moduleTypes: {
        ".js": "jsx",
      },
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
}));
