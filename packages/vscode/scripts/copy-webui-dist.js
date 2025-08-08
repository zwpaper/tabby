const fs = require("node:fs");
const path = require("node:path");

const sourceBaseDir = path.resolve(__dirname, "../../vscode-webui/dist/index");
const destBaseDir = path.resolve(
  __dirname,
  "../../vscode/assets/webview-ui/dist",
);

// Ensure destination directory exists
fs.mkdirSync(destBaseDir, { recursive: true });

const filesToCopy = ["index.js", "index.css", "wa-sqlite.wasm"];

// Copy fixed-name files
for (const file of filesToCopy) {
  const sourcePath = path.join(sourceBaseDir, file);
  const destPath = path.join(destBaseDir, file);
  fs.copyFileSync(sourcePath, destPath);
  console.log(`Copied ${sourcePath} to ${destPath}`);
}
