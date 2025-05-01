import type { ClientToolsType } from "@ragdoll/tools";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const globFilesTool: React.FC<
  ToolProps<ClientToolsType["globFiles"]>
> = ({ tool, isExecuting }) => {
  const { path, globPattern } = tool.args || {};

  let resultEl: React.ReactNode;
  let error: string | undefined;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    !("error" in tool.result)
  ) {
    const { files, isTruncated } = tool.result;
    const fileCount = files.length;

    resultEl = (
      <div className="text-sm mt-1">
        <div className="text-xs text-gray-600">
          {fileCount} matching files
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
          searching in <span className="font-mono">{path}</span> for pattern{" "}
          <span className="font-mono text-blue-500">{globPattern}</span>
        </span>
      </div>
      {resultEl}
    </div>
  );
};
