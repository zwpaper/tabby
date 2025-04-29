import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const readFileTool: React.FC<ToolProps<ClientToolsType["readFile"]>> = ({
  tool,
  isExecuting,
}) => {
  let error: string | undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  const { path, startLine, endLine } = tool.args || {};
  return (
    <div className="ml-1 text-sm flex gap-2 items-center" title={error}>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      Reading
      {path && (
        <FileBadge path={path} startLine={startLine} endLine={endLine} />
      )}
    </div>
  );
};
