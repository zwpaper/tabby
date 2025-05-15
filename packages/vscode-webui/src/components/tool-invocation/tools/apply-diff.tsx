import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { FileBadge } from "../file-badge";
import { NewProblems } from "../new-problems";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";
import { UserEdits } from "../user-edits";

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
    <>
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
    </>
  );

  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={
        result?.userEdits && <UserEdits userEdits={result?.userEdits} />
      }
      detail={
        result?.newProblems && <NewProblems newProblems={result?.newProblems} />
      }
    />
  );
};
