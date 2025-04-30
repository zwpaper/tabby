import { useChatStore } from "@/lib/stores/chat-store";
import { isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useState } from "react";
import { useVSCodeTool } from "./hooks/use-vscode-tool";
import { AskFollowupQuestionTool } from "./tools/ask-followup-question";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { readFileTool } from "./tools/read-file";
import { searchFilesTool } from "./tools/search-files";
import { writeToFileTool } from "./tools/write-to-file";
import type { ApprovalStatus, ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  addToolResult,
  setInput,
}: {
  tool: ToolInvocation;
  setInput: (prompt: string) => void;
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => void;
}) {
  const { state } = tool;
  const userInputTool = isUserInputTool(tool.toolName);
  const { updatePendingToolApproval } = useChatStore();
  const [approvalStatus, setApprovalStatus] =
    useState<ApprovalStatus>("pending");

  useEffect(() => {
    if (state === "call" && !userInputTool && approvalStatus === "pending") {
      updatePendingToolApproval({
        tool,
        resolve: (approved) =>
          setApprovalStatus(approved ? "approved" : "rejected"),
      });
    }
  }, [state, userInputTool, approvalStatus, tool, updatePendingToolApproval]);

  const onResult = useCallback(
    (result: unknown) => {
      addToolResult({ toolCallId: tool.toolCallId, result });
    },
    [addToolResult, tool.toolCallId],
  );
  const { isExecuting } = useVSCodeTool(approvalStatus, tool, onResult);

  const C = Tools[tool.toolName];
  return (
    <div className="flex flex-col gap-1">
      {C ? (
        <C tool={tool} isExecuting={isExecuting} setInput={setInput} />
      ) : (
        JSON.stringify(tool, null, 2)
      )}
    </div>
  );
}

const Tools: Record<string, React.FC<ToolProps>> = {
  attemptCompletion: AttemptCompletionTool,
  readFile: readFileTool,
  writeToFile: writeToFileTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  searchFiles: searchFilesTool,
};
