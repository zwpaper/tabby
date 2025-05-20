import type { ClientToolsType } from "@ragdoll/tools";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const todoWriteTool: React.FC<
  ToolProps<ClientToolsType["todoWrite"]>
> = ({ tool, isExecuting }) => {
  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Updating TODOs
    </>
  );

  return <ExpandableToolContainer title={title} />;
};
