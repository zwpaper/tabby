import { useExecuteTool } from "@/lib/tools";
import { Box } from "ink";
import {
  ApplyDiffTool,
  AskFollowupQuestionTool,
  ConfirmToolUsage,
  ErrorResult,
  ExecuteCommandTool,
  ListFilesTool,
  ReadFileTool,
  SearchFilesTool,
  TaskCompleteTool,
  WriteToFileTool,
} from "./tool-box/index"; // Import from the new index file
import type { ToolProps } from "./tool-box/types"; // Import types

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
