import { CodeBlock } from "@/components/message";
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

  const { cwd, command } = tool.args || {};
  const cwdNode = cwd ? (
    <span>
      {" "}
      in <b>{cwd}</b>
    </span>
  ) : null;
  return (
    <div className="text-sm" title={error}>
      <div>
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        <span className="ml-2">
          I will execute the following command{cwdNode}
        </span>
      </div>
      <CodeBlock
        className="mt-1.5"
        language={"bash"}
        value={command || ""}
        canWrapLongLines={true}
      />
    </div>
  );
};
