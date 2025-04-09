import fs from "node:fs";
import path from "node:path";
import { listFiles } from "@/lib/tools/list-files";
import type { Environment } from "@ragdoll/server";
import { useCallback, useEffect, useRef } from "react";

export function useEnvironment() {
  const environment = useRef<Environment | null>(null);

  const reload = useCallback(async () => {
    const listFilesOutput = await listFiles({ path: ".", recursive: true });
    const cwd = process.cwd();
    const workspace =
      "files" in listFilesOutput
        ? listFilesOutput
        : { files: [], isTruncated: false }; // Default or handle loading state
    const customRules = collectCustomRules();
    const info = {
      cwd,
      shell: process.env.SHELL || "",
      os: process.platform,
      homedir: process.env.HOME || "",
      customRules,
    };

    environment.current = {
      currentTime: new Date().toString(),
      workspace,
      info,
    };
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { environment, reload };
}

// Recursively read `README.pochi.md` files from cwd to root, concat them in order
// Skip if go over .git boundary
function collectCustomRules() {
  let rules = "";
  let cwd = process.cwd();
  while (cwd !== "/") {
    const rulePath = path.join(cwd, "README.pochi.md");
    try {
      if (fs.existsSync(rulePath)) {
        const rule = fs.readFileSync(rulePath, "utf8");
        rules += `# Rules from ${rulePath}\n${rule}\n`;
      }
    } catch (error) {
      // Ignore errors
    }

    // Skip if go over .git boundary
    if (fs.existsSync(path.join(cwd, ".git"))) {
      break;
    }

    cwd = path.dirname(cwd);
  }
  if (rules.length === 0) {
    return undefined;
  }
  return rules;
}
