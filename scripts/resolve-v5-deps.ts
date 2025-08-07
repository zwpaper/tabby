import fs from "node:fs/promises";
import path from "node:path";

const isSilent = process.argv.includes("--silent");

const log = (...args: unknown[]) => {
  if (!isSilent) {
    console.log(...args);
  }
};

const warn = (...args: unknown[]) => {
  console.warn(...args);
};

const aiV5SdkPath = path.resolve(process.cwd(), "node_modules", "@ai-v5-sdk");
const packagesToResolve = [
  ["ai", "ai"],
  ["@ai-sdk/provider", "provider"],
  ["@ai-sdk/provider-utils", "provider-utils"],
  ["@ai-sdk/openai-compatible", "openai-compatible"],
  ["@ai-sdk/google", "google"],
  ["@ai-sdk/anthropic", "anthropic"],
];

async function checkNodeModules(dirPath: string): Promise<boolean> {
  let hasError = false;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;

      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Recurse into scoped directories
        if (entry.name.startsWith("@")) {
          if (await checkNodeModules(fullPath)) {
            hasError = true;
          }
        } else {
          warn(`Warning: non-symlinked package found: ${fullPath}`);
          hasError = true;
        }
      } else if (!entry.isSymbolicLink()) {
        warn(`Warning: non-symlinked package found: ${fullPath}`);
        hasError = true;
      }
    }
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code !== "ENOENT") {
      console.error(`Error checking node_modules in ${dirPath}:`, error);
      hasError = true;
    }
  }
  return hasError;
}

async function resolveV5Deps(): Promise<number> {
  let hasError = false;
  try {
    const subDirs = await fs.readdir(aiV5SdkPath, { withFileTypes: true });
    for (const dir of subDirs) {
      if (dir.isDirectory()) {
        const packageJsonPath = path.join(
          aiV5SdkPath,
          dir.name,
          "package.json",
        );
        try {
          const packageJsonContent = await fs.readFile(
            packageJsonPath,
            "utf-8",
          );
          const packageJson = JSON.parse(packageJsonContent);

          if (packageJson.dependencies) {
            for (const [pkg, map] of packagesToResolve) {
              if (packageJson.dependencies[pkg]) {
                log(`Resolving dependency '${pkg}' in ${dir.name}`);

                const packageNodeModulesPath = path.join(
                  aiV5SdkPath,
                  dir.name,
                  "node_modules",
                );
                const symlinkPath = path.join(packageNodeModulesPath, pkg);
                const targetPath = path.relative(
                  path.dirname(symlinkPath),
                  path.join(aiV5SdkPath, map),
                );

                try {
                  await fs.rm(symlinkPath, { recursive: true, force: true });
                } catch (rmError) {
                  // ignore
                }

                await fs.mkdir(path.dirname(symlinkPath), { recursive: true });
                await fs.symlink(targetPath, symlinkPath, "dir");
                log(`  -> Created symlink: ${symlinkPath} -> ${targetPath}`);
              }
            }
          }

          const nodeModulesPath = path.join(
            aiV5SdkPath,
            dir.name,
            "node_modules",
          );
          if (await checkNodeModules(nodeModulesPath)) {
            hasError = true;
          }
        } catch (error) {
          if (
            error instanceof Error &&
            "code" in error &&
            error.code === "ENOENT"
          ) {
            // not a package, skip
          } else {
            console.error(`Error processing ${dir.name}:`, error);
            hasError = true;
          }
        }
      }
    }

    // Final check on root node_modules
    log("\nChecking root node_modules...");
    const rootNodeModules = path.resolve(process.cwd(), "node_modules");
    const entries = await fs.readdir(rootNodeModules, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (!entry.isDirectory() && !entry.isSymbolicLink()) {
        warn(`Warning: file found in root node_modules: ${entry.name}`);
        hasError = true;
      }
    }

    if (hasError) {
      console.error("\n❌ Dependency resolution finished with errors.");
      return 1;
    }

    log("\n✅ Dependency resolution complete.");
    return 0;
  } catch (error) {
    console.error("Error reading @ai-v5-sdk directory:", error);
    return 1;
  }
}

resolveV5Deps().then(process.exit);
