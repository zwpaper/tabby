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
    <div className="text-sm" title={error}>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Reading
      {path && (
        <FileBadge
          className="ml-2"
          path={path}
          startLine={startLine}
          endLine={endLine}
        />
      )}
    </div>
  );
};
