import { CodeBlock } from "@/components/message";
import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { FileBadge } from "../file-badge";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
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

  const result =
    tool.state === "result" && !("error" in tool.result)
      ? tool.result
      : undefined;

  const title = (
    <span className="pr-1">
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      <span>
        {isExecuting ? "Applying" : isSuccess ? "Applied" : "Apply"} diff to
      </span>
      <span className="ml-2" />
      {path && (
        <FileBadge
          path={path}
          startLine={startLine}
          endLine={endLine}
          onClick={tool.state !== "result" ? handleClick : undefined}
        />
      )}
    </span>
  );

  const detail = result?.userEdits ? (
    <div className="my-2 ml-1 flex flex-col">
      <CodeBlock className="" language="diff" value={result?.userEdits} />
      <p className="mt-1 self-center text-xs italic">
        You have made the above edits
      </p>
    </div>
  ) : null;

  return <ExpandableToolContainer title={title} detail={detail} />;
};
