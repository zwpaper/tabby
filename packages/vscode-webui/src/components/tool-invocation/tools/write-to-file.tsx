import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const writeToFileTool: React.FC<
  ToolProps<ClientToolsType["writeToFile"]>
> = ({ tool, isExecuting }) => {
  let error: string | undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  const { path } = tool.args || {};
  return (
    <div className="ml-1 text-sm flex gap-2 items-center" title={error}>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      Writing
      {path && <FileBadge path={path} />}
    </div>
  );
};
