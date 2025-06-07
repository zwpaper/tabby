import { useToolCallLifeCycle } from "@/features/chat";
import type { ToolInvocation } from "ai";
import { McpToolCall } from "./mcp-tool-call";
import { applyDiffTool } from "./tools/apply-diff";
import { AskFollowupQuestionTool } from "./tools/ask-followup-question";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { executeCommandTool } from "./tools/execute-command";
import { globFilesTool } from "./tools/glob-files";
import { listFilesTool } from "./tools/list-files";
import { multiApplyDiffTool } from "./tools/multi-apply-diff";
import { readFileTool } from "./tools/read-file";
import { searchFilesTool } from "./tools/search-files";
import { todoWriteTool } from "./tools/todo-write";
import { webFetchTool } from "./tools/web-fetch";
import { writeToFileTool } from "./tools/write-to-file";
import type { ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  isLoading,
}: {
  tool: ToolInvocation;
  isLoading: boolean;
}) {
  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle(
    tool.toolName,
    tool.toolCallId,
  );
  const isExecuting = lifecycle.status.startsWith("execute");
  const C = Tools[tool.toolName];

  return (
    <div className="flex flex-col gap-1">
      {C ? (
        <C tool={tool} isExecuting={isExecuting} isLoading={isLoading} />
      ) : (
        <McpToolCall tool={tool} isExecuting={isExecuting} />
      )}
    </div>
  );
}

const Tools: Record<string, React.FC<ToolProps>> = {
  attemptCompletion: AttemptCompletionTool,
  readFile: readFileTool,
  writeToFile: writeToFileTool,
  applyDiff: applyDiffTool,
  multiApplyDiff: multiApplyDiffTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  executeCommand: executeCommandTool,
  searchFiles: searchFilesTool,
  listFiles: listFilesTool,
  globFiles: globFilesTool,
  webFetch: webFetchTool,
  todoWrite: todoWriteTool,
};
