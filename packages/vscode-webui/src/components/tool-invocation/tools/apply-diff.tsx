import { useToolCallLifeCycle } from "@/features/chat";
import type { ClientToolsType } from "@ragdoll/tools";
import { useCallback } from "react";
import { FileBadge } from "../file-badge";
import { NewProblems, NewProblemsIcon } from "../new-problems";
import { StatusIcon } from "../status-icon";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";
import { UserEdits } from "../user-edits";

export const applyDiffTool: React.FC<
  ToolProps<ClientToolsType["applyDiff"]>
> = ({ tool, isExecuting }) => {
  const { path } = tool.args || {};
  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle(
    tool.toolName,
    tool.toolCallId,
  );
  const handleClick = useCallback(() => {
    lifecycle.preview(tool.args, tool.state);
  }, [tool, lifecycle]);

  const result =
    tool.state === "result" && !("error" in tool.result)
      ? tool.result
      : undefined;

  const title = (
    <>
      <StatusIcon isExecuting={isExecuting} tool={tool} />
      <span className="ml-2" />
      {"Applying diff to "}
      {path && (
        <FileBadge
          className="ml-1"
          path={path}
          onClick={tool.state !== "result" ? handleClick : undefined}
          editSummary={result?._meta?.editSummary}
        />
      )}
    </>
  );

  const details = [];
  if (result?.newProblems) {
    details.push(
      <NewProblems key="new-problems" newProblems={result?.newProblems} />,
    );
  }

  if (result?.userEdits) {
    details.push(<UserEdits key="user-edits" userEdits={result?.userEdits} />);
  }

  const detail = details.length > 0 ? <>{details}</> : undefined;

  return (
    <ExpandableToolContainer
      title={title}
      expandableDetail={detail}
      expandableDetailIcon={result?.newProblems && <NewProblemsIcon />}
    />
  );
};
