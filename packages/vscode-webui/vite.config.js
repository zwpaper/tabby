import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import EnvironmentPlugin from "vite-plugin-environment";
import tsconfigPaths from "vite-tsconfig-paths";

const BuildTarget = process.env.POCHI_BUILD_TARGET || "index";
const BuildSingleFile = BuildTarget === "index";

const CommonOutputOptions = {
  dir: resolve(__dirname, "dist", BuildTarget),
};

const OutputOptions = {
  index: {
    ...CommonOutputOptions,
    manualChunks: false,
    inlineDynamicImports: true,
    entryFileNames: "[name].js",
    assetFileNames: "[name].[ext]",
  },
  share: {
    ...CommonOutputOptions,
  },
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    EnvironmentPlugin({
      POCHI_LOCAL_SERVER: "false",
    }),
    tsconfigPaths(),
    TanStackRouterVite({ autoCodeSplitting: true }),
    viteReact({
      babel: {
        plugins: [["module:@preact/signals-react-transform"]],
      },
    }),
    tailwindcss(),
  ],
  build: {
    rollupOptions: {
      input: {
        [BuildTarget]: resolve(__dirname, `${BuildTarget}.html`),
      },
      output: OutputOptions[BuildTarget],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
  server: {
    cors: true,
    hmr: {
      host: "localhost",
      protocol: "ws",
    },
  },
});
