import { useExecuteTool } from "@/lib/tools";
import { Box } from "ink";
import { ApplyDiffTool } from "./apply-diff-tool";
import { AskFollowupQuestionTool } from "./ask-followup-question-tool";
import { ConfirmToolUsage } from "./confirm-tool-usage";
import { ErrorResult } from "./error-result";
import { ExecuteCommandTool } from "./execute-command-tool";
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
  listFiles: ListFilesTool,
  readFile: ReadFileTool,
  searchFiles: SearchFilesTool,
  writeToFile: WriteToFileTool,
};

const ToolBox: React.FC<
  ToolProps & {
    addToolResult: (args: { toolCallId: string; result: unknown }) => void;
  }
> = ({ toolCall, addToolResult }) => {
  const { approval, approveTool } = useExecuteTool({
    toolCall,
    addToolResult,
  });

  const C = ToolComponents[toolCall.toolName];
  const children = (
    <>
      {C ? (
        <C toolCall={toolCall} />
      ) : (
        <Box>Unknown tool: {toolCall.toolName}</Box>
      )}
      {approval === "pending" && <ConfirmToolUsage confirm={approveTool} />}
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
