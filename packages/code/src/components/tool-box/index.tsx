import { isDefaultApproved, isUserInputTool } from "@/lib/tools";
import { Spinner } from "@inkjs/ui";
import { Box } from "ink";
import { useEffect, useState } from "react";
import { ApplyDiffTool } from "./apply-diff-tool";
import { AskFollowupQuestionTool } from "./ask-followup-question-tool";
import { ConfirmPrompt } from "./confirm-prompt";
import { ErrorResult } from "./error-result";
import { ExecuteCommandTool } from "./execute-command-tool";
import { GlobFilesTool } from "./glob-files-tool";
import { ListFilesTool } from "./list-files-tool";
import { ReadFileTool } from "./read-file-tool";
import { SearchFilesTool } from "./search-files-tool";
import { TaskCompleteTool } from "./task-complete-tool";
import type { ToolProps } from "./types"; // Import types
import { WriteToFileTool } from "./write-to-file-tool";

const ToolComponents: Record<string, React.FC<ToolProps>> = {
  applyDiff: ApplyDiffTool,
  attemptCompletion: TaskCompleteTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  executeCommand: ExecuteCommandTool,
  globFiles: GlobFilesTool,
  listFiles: ListFilesTool,
  readFile: ReadFileTool,
  searchFiles: SearchFilesTool,
  writeToFile: WriteToFileTool,
};

const ToolBox: React.FC<
  ToolProps & {
    runningToolCall: ToolProps["toolCall"] | null;
    onToolCall: (toolCall: ToolProps["toolCall"], approved: boolean) => void;
    abortToolCall: () => void;
  }
> = ({ toolCall, onToolCall, abortToolCall, runningToolCall }) => {
  const pendingApproval =
    runningToolCall === null &&
    toolCall.state === "call" &&
    !isUserInputTool(toolCall.toolName);
  useEffect(() => {
    if (pendingApproval && isDefaultApproved(toolCall)) {
      onToolCall(toolCall, true);
    }
  }, [pendingApproval, onToolCall, toolCall]);

  const isRunning = runningToolCall?.toolCallId === toolCall.toolCallId;
  const [showAbort, setShowAbort] = useState(false);
  useEffect(() => {
    if (isRunning) {
      const timeoutId = setTimeout(() => setShowAbort(true), 2000);
      return () => clearTimeout(timeoutId);
    }
    setShowAbort(false);
  }, [isRunning]);

  const C = ToolComponents[toolCall.toolName];
  const children = (
    <>
      {C ? (
        <C toolCall={toolCall} />
      ) : (
        <Box>Unknown tool: {toolCall.toolName}</Box>
      )}
      {pendingApproval && (
        <ConfirmPrompt
          confirm={(approved) => onToolCall(toolCall, approved)}
          prompt="Allow this tool to run?"
        />
      )}
      {isRunning && <Spinner />}
      {showAbort && isRunning && (
        <ConfirmPrompt
          confirm={(yes) => yes && abortToolCall()}
          prompt="Abort this tool?"
        />
      )}
      {toolCall.state === "result" &&
        typeof toolCall.result === "object" &&
        toolCall.result !== null && // Added null check for safety
        "error" in toolCall.result && (
          <ErrorResult error={(toolCall.result as { error: string }).error} /> // Type assertion
        )}
    </>
  );
  const boxProps = {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: "grey",
    marginLeft: 1,
    padding: 1,
    gap: 1,
  } as const;

  return <Box {...boxProps}>{children}</Box>;
};

export default ToolBox;
