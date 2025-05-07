import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const applyDiffTool: React.FC<
  ToolProps<ClientToolsType["applyDiff"]>
> = ({ tool, isExecuting }) => {
  const { path, startLine, endLine } = tool.args || {};

  let error: string | undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  // Determine if the operation was successful
  const isSuccess =
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    "success" in tool.result &&
    tool.result.success === true;

  return (
    <div className="flex flex-col gap-1 text-sm" title={error}>
      <div className="flex items-center gap-2">
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        {isExecuting ? "Applying" : isSuccess ? "Applied" : "Apply"} diff to
        {path && (
          <FileBadge path={path} startLine={startLine} endLine={endLine} />
        )}
      </div>
    </div>
  );
};
