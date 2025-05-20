import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import type { ClientToolsType } from "@ragdoll/tools";
import { Bug } from "lucide-react";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const todoWriteTool: React.FC<
  ToolProps<ClientToolsType["todoWrite"]>
> = ({ tool, isExecuting }) => {
  const [isDevMode] = useIsDevMode();
  if (!isDevMode) return null;

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Updating TODOs
      <Bug className="ml-2 inline size-3" />
    </>
  );

  return <ExpandableToolContainer title={title} />;
};
