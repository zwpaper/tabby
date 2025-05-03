import { useChatStore } from "@/lib/stores/chat-store";
import { useToolAutoApproval } from "@/lib/stores/settings-store";
import type { UseChatHelpers } from "@ai-sdk/react";
import { type ClientToolsType, isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVSCodeTool } from "./hooks/use-vscode-tool";
import { applyDiffTool } from "./tools/apply-diff";
import { AskFollowupQuestionTool } from "./tools/ask-followup-question";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { executeCommandTool } from "./tools/execute-command";
import { globFilesTool } from "./tools/glob-files";
import { listFilesTool } from "./tools/list-files";
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
  addToolResult?: ({
    toolCallId,
    result,
  }: { toolCallId: string; result: unknown }) => void;
  status: UseChatHelpers["status"];
}) {
  const { state, toolName } = tool;
  const userInputTool = isUserInputTool(toolName);
  const { pendingApproval, updatePendingApproval } = useChatStore();
  const isAutoApproved = useToolAutoApproval(toolName as keyof ClientToolsType);
  const [approvalStatus, setApprovalStatus] = useState<ApprovalStatus>(
    isAutoApproved ? "approved" : "pending",
  );

  useEffect(() => {
    if (pendingApproval !== undefined) return;
    if (state === "call" && !userInputTool && approvalStatus === "pending") {
      const pendingApproval = addToolResult
        ? {
            name: toolName,
            resolve: (approved: boolean) =>
              setApprovalStatus(approved ? "approved" : "rejected"),
          }
        : undefined;
      updatePendingApproval(pendingApproval);
    }
  }, [
    state,
    userInputTool,
    approvalStatus,
    addToolResult,
    toolName,
    updatePendingApproval,
    pendingApproval,
  ]);

  const onResult = useCallback(
    (result: unknown) => {
      addToolResult?.({ toolCallId: tool.toolCallId, result });
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
  applyDiff: applyDiffTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  executeCommand: executeCommandTool,
  searchFiles: searchFilesTool,
  listFiles: listFilesTool,
  globFiles: globFilesTool,
};

export function AutoRejectTool({
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
  const rejected = useRef(false);
  useEffect(() => {
    if (!rejected.current) {
      rejected.current = true;
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          error: "Tool invocation rejected by user",
        },
      });
    }
  }, [tool, addToolResult]);
  return null;
}
