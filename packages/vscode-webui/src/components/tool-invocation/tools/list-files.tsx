import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const listFilesTool: React.FC<
  ToolProps<ClientToolsType["listFiles"]>
> = ({ tool, isExecuting }) => {
  const { path } = tool.args || {};

  return (
    <div className="text-sm">
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      {path && (
        <span>
          Read <FileBadge path={path} />
        </span>
      )}
    </div>
  );
};
