import { useChatStore } from "@/lib/stores/chat-store";
import { useToolAutoApproval } from "@/lib/stores/settings-store";
import type { UseChatHelpers } from "@ai-sdk/react";
import { type ClientToolsType, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useState } from "react";
import { useVSCodeTool } from "./hooks/use-vscode-tool";
import { AskFollowupQuestionTool } from "./tools/ask-followup-question";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { executeCommandTool } from "./tools/execute-command";
import { readFileTool } from "./tools/read-file";
import { searchFilesTool } from "./tools/search-files";
import { writeToFileTool } from "./tools/write-to-file";
import type { ApprovalStatus, ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  addToolResult,
  setInput,
  status,
}: {
  tool: ToolInvocation;
  setInput: (prompt: string) => void;
  addToolResult: ({
    toolCallId,
    result,
  }: { toolCallId: string; result: unknown }) => void;
  status: UseChatHelpers["status"];
}) {
  const { state } = tool;
  const userInputTool = isUserInputTool(tool.toolName);
  const { updatePendingToolApproval } = useChatStore();
  const isAutoApproved = useToolAutoApproval(
    tool.toolName as keyof ClientToolsType,
  );
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    isAutoApproved ? "approved" : "pending",
  );

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
  const { isExecuting } = useVSCodeTool(status, approvalStatus, tool, onResult);

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
  executeCommand: executeCommandTool,
  searchFiles: searchFilesTool,
};
