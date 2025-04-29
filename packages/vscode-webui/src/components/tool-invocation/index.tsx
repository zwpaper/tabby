import { isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useCallback, useState } from "react";
import { Button } from "../ui/button";
import { useVSCodeTool } from "./hooks/use-vscode-tool";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { readFileTool } from "./tools/read-file";
import { writeToFileTool } from "./tools/write-to-file";
import type { ApprovalStatus, ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  addToolResult,
}: {
  tool: ToolInvocation;
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;
}) {
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("pending");
  const onResult = useCallback(
    (result: unknown) => {
      addToolResult({ toolCallId: tool.toolCallId, result });
    },
    [addToolResult, tool.toolCallId],
  );
  const { isExecuting } = useVSCodeTool(approvalStatus, tool, onResult);

  const userInputTool = isUserInputTool(tool.toolName);
  const showApproval =
    tool.state === "call" &&
    !userInputTool &&
    approvalStatus === "pending" &&
    !isExecuting;

  const C = Tools[tool.toolName];
  return (
    <div className="flex flex-col gap-1">
      {C ? (
        <C tool={tool} isExecuting={isExecuting} />
      ) : (
        JSON.stringify(tool, null, 2)
      )}
      {showApproval && <ToolApproval onSubmit={setApprovalStatus} />}
    </div>
  );
}

function ToolApproval({
  onSubmit,
}: {
  onSubmit: (status: ApprovalStatus) => void;
}) {
  const onApprove = () => {
    onSubmit("approved");
  };
  const onReject = () => {
    onSubmit("rejected");
  };
  return (
    <div className="flex gap-2">
      <Button onClick={onApprove}>Approve</Button>
      <Button onClick={onReject}>Reject</Button>
    </div>
  );
}

const Tools: Record<string, React.FC<ToolProps>> = {
  attemptCompletion: AttemptCompletionTool,
  readFile: readFileTool,
  writeToFile: writeToFileTool,
};
