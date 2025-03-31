import { listFiles } from "@/lib/tools/list-files";
import type { ListFilesOutputType } from "@ragdoll/tools";
import { useEffect, useState } from "react";

export function useWorkspaceFiles() {
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
