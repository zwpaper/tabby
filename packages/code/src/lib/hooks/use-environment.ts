import fs from "node:fs";
import path from "node:path";
import { listFiles } from "@/lib/tools/list-files";
import type { Environment } from "@ragdoll/server";
import { useEffect, useRef } from "react";

export function useEnvironment() {
  const environment = useRef<Environment | null>(null);

  const reload = async () => {
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
  };

  useEffect(() => {
    reload();
  }, []);

  return { environment, reload };
}

// Recursively read `.cursorrules` files from cwd to root, concat them in order
function collectCustomRules() {
  let rules = "";
  let cwd = process.cwd();
  while (cwd !== "/") {
    const rulePath = path.join(cwd, ".cursorrules");
    try {
      if (fs.existsSync(rulePath)) {
        const rule = fs.readFileSync(rulePath, "utf8");
        rules += `# Rules from ${rulePath}\n${rule}\n`;
      }
    } catch (error) {
      // Ignore errors
    }
    cwd = path.dirname(cwd);
  }
  if (rules.length === 0) {
    return undefined;
  }
  return rules;
}
