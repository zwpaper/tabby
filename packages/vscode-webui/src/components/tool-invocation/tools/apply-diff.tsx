import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import type { ToolProps } from "../types";

export const applyDiffTool: React.FC<
  ToolProps<ClientToolsType["applyDiff"]>
> = ({ tool, isExecuting }) => {
  const { path, startLine, endLine } = tool.args || {};

  // Determine if the operation was successful
  const isSuccess =
    tool.state === "result" &&
    typeof tool.result === "object" &&
    tool.result !== null &&
    "success" in tool.result &&
    tool.result.success === true;
  const handleClick = useCallback(() => {
    vscodeHost.previewToolCall(tool.toolName, tool.args, {
      toolCallId: tool.toolCallId,
      state: tool.state,
    });
  }, [tool.args, tool.toolCallId, tool.toolName, tool.state]);

  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="space-x-2">
        <StatusIcon isExecuting={isExecuting} tool={tool} />
        <span>
          {isExecuting ? "Applying" : isSuccess ? "Applied" : "Apply"} diff to
        </span>
        {path && (
          <FileBadge
            path={path}
            startLine={startLine}
            endLine={endLine}
            onClick={tool.state !== "result" ? handleClick : undefined}
          />
        )}
      </span>
    </div>
  );
};
