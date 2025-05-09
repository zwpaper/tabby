import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "@vscode/test-cli";

// Get directory path in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  files: "out/**/*.test.js",
  mocha: {
    ui: "tdd",
    timeout: 10000,
    /** Set up alias path resolution during tests */
    require: ["tsconfig-paths/register"],
  },
  version: "stable",
  extensionDevelopmentPath: path.resolve(__dirname),
  installExtensions: ["ms-vscode.js-debug-nightly"],
});
