import type { ClientToolsType } from "@ragdoll/tools";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const listFilesTool: React.FC<
  ToolProps<ClientToolsType["listFiles"]>
> = ({ tool, isExecuting }) => {
  const { path } = tool.args || {};

  let resultEl: React.ReactNode;
  let error: string | undefined;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    const { files, isTruncated } = tool.result;

    // Count directories vs files
    const dirPaths = new Set<string>();

    for (const filePath of files) {
      const lastSlashIndex = filePath.lastIndexOf("/");
      if (lastSlashIndex !== -1) {
        const dirPath = filePath.substring(0, lastSlashIndex + 1);
        if (dirPath !== "") {
          dirPaths.add(dirPath);
        }
      }
    }

    const dirCount = dirPaths.size;
    const fileCount = files.length;

    resultEl = (
      <div className="text-sm mt-1">
        <div className="text-xs text-gray-600">
          {fileCount} files {dirCount > 0 ? `in ${dirCount} directories` : ""}
          {isTruncated && " (results truncated)"}
        </div>
      </div>
    );
  }

  return (
    <div className="text-sm" title={error}>
      <div className="flex gap-2 items-center">
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        <span>
          listing files in <span className="font-mono">{path}</span>
        </span>
      </div>
      {resultEl}
    </div>
  );
};
