import { useWorkspaceFiles } from "@/lib/hooks/use-workspace-files";
import type { Environment } from "@ragdoll/server";
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
    const info = {
      cwd,
      shell: process.env.SHELL || "",
      os: process.platform,
      homedir: process.env.HOME || "",
    };

    setEnvironment({
      currentTime: new Date().toString(),
      workspace,
      info,
    });
  }, [listFilesOutput]); // Re-run if listFilesOutput changes

  return environment;
}
