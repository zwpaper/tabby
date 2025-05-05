import type { ClientToolsType } from "@ragdoll/tools";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const executeCommandTool: React.FC<
  ToolProps<ClientToolsType["executeCommand"]>
> = ({ tool, isExecuting }) => {
  let error: string | undefined;
  if (tool.state === "result" && "error" in tool.result) {
    error = tool.result.error;
  }

  const { command } = tool.args || {};
  return (
    <div className="text-sm" title={error}>
      <div>
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        <span className="ml-2">I will execute the following command:</span>
      </div>
      <pre className="mt-1 p-2 rounded border border-zinc-700 text-wrap">
        <code>{command}</code>
      </pre>
    </div>
  );
};
