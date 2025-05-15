import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { FileBadge } from "../file-badge";
import { NewProblems } from "../new-problems";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";
import { UserEdits } from "../user-edits";

export const writeToFileTool: React.FC<
  ToolProps<ClientToolsType["writeToFile"]>
> = ({ tool, isExecuting }) => {
  const handleClick = useCallback(() => {
    vscodeHost.previewToolCall(tool.toolName, tool.args, {
      toolCallId: tool.toolCallId,
      state: tool.state,
    });
  }, [tool.args, tool.toolCallId, tool.toolName, tool.state]);

  const { path } = tool.args || {};

  const result =
    tool.state === "result" && !("error" in tool.result)
      ? tool.result
      : undefined;

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      Writing
      {path && (
        <FileBadge
          className="ml-2"
          path={path}
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
