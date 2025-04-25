import fs from "node:fs";
import path from "node:path";
import { traverseBFS } from "@/lib/file-utils";
import type { Environment } from "@ragdoll/server";
import { useCallback, useEffect, useRef } from "react";

export function useEnvironment(customRuleFiles: string[]) {
  const environment = useRef<Environment | null>(null);

  const reload = useCallback(async () => {
    const listFilesOutput = await traverseBFS(".", true, 500);
    const cwd = process.cwd();
    const workspace =
      "files" in listFilesOutput
        ? listFilesOutput
        : { files: [], isTruncated: false }; // Default or handle loading state
    const customRules = collectCustomRules(customRuleFiles);
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
  }, [customRuleFiles]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { environment, reload };
}

// try read `README.pochi.md` from cwd, also collect custom rules from `customRuleFiles`
function collectCustomRules(customRuleFiles: string[]) {
  const cwd = process.cwd();
  let rules = "";

  try {
    const rulePath = path.join(cwd, "README.pochi.md");
    if (fs.existsSync(rulePath)) {
      const rule = fs.readFileSync(rulePath, "utf-8");
      rules += `# Rules from ${rulePath}\n${rule}\n`;
    }
  } catch (error) {
    // Ignore errors
  }

  for (const rulePath of customRuleFiles) {
    const rule = fs.readFileSync(rulePath, "utf-8");
    rules += `# Rules from ${rulePath}\n${rule}\n`;
  }

  if (rules.length === 0) {
    return undefined;
  }
  return rules;
}
