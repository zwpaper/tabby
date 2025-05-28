import type { ClientToolsType } from "@ragdoll/tools";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const readFileTool: React.FC<ToolProps<ClientToolsType["readFile"]>> = ({
  tool,
  isExecuting,
}) => {
  const { path, startLine, endLine } = tool.args || {};
  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      {"Reading "}
      {path && (
        <FileBadge
          className="ml-1"
          path={path}
          startLine={startLine}
          endLine={endLine}
        />
      )}
    </>
  );
  return <ExpandableToolContainer title={title} />;
};
