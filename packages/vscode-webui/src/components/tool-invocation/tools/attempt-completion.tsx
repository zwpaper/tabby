import type { ClientToolsType } from "@ragdoll/tools";
import type { ToolProps } from "../types";

export const AttemptCompletionTool: React.FC<
  ToolProps<ClientToolsType["attemptCompletion"]>
> = ({ tool: toolCall }) => {
  const { result = "", command = undefined } = toolCall.args || {};
  return (
    <div>
      <span>Task completed: {result}</span>
      {command && <pre>{command}</pre>}
    </div>
  );
};
