import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
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
  const handleClick = useCallback(() => {
    vscodeHost.previewToolCall(tool.toolName, tool.args, {
      toolCallId: tool.toolCallId,
      state: tool.state,
    });
  }, [tool.args, tool.toolCallId, tool.toolName, tool.state]);

  const { path } = tool.args || {};
  return (
    <div className="text-sm" title={error}>
      <StatusIcon
        isExecuting={isExecuting}
        tool={tool}
        onClick={tool.state !== "result" ? handleClick : undefined}
      />
      <span className="ml-2" />
      Writing
      {path && <FileBadge className="ml-2" path={path} />}
    </div>
  );
};
