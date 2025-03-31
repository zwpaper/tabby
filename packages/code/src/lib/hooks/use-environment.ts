import fs from "node:fs";
import path from "node:path";
import { listFiles } from "@/lib/tools/list-files";
import type { Environment } from "@ragdoll/server";
import type { ListFilesOutputType } from "@ragdoll/tools";
import { useEffect, useState } from "react";

export function useEnvironment() {
  const listFilesOutput = useWorkspaceFiles();
  const [environment, setEnvironment] = useState<Environment | null>(null);

  useEffect(() => {
    // Ensure listFilesOutput is loaded before setting the environment
    if (!listFilesOutput) {
      return;
    }

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

    setEnvironment({
      currentTime: new Date().toString(),
      workspace,
      info,
    });
  }, [listFilesOutput]); // Re-run if listFilesOutput changes

  return environment;
}

function useWorkspaceFiles() {
  const [workspaceFiles, setWorkspaceFiles] = useState<ListFilesOutputType>({
    files: [],
    isTruncated: false,
  });
  useEffect(() => {
    // Initial fetch
    listFiles({ path: ".", recursive: true }).then(setWorkspaceFiles);

    // Fetch every 5 seconds
    const handle = setInterval(async () => {
      const x = await listFiles({ path: ".", recursive: true });
      setWorkspaceFiles(x);
    }, 5000);
    return () => clearInterval(handle);
  }, []);
  return workspaceFiles;
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
