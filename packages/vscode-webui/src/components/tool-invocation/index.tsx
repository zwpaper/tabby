import { useExecutingToolCallIds } from "@/features/chat";
import type {
  ChatRequestOptions,
  CreateMessage,
  Message,
  ToolInvocation,
} from "ai";
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
  sendMessage,
  isLoading,
}: {
  tool: ToolInvocation;
  sendMessage: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  isLoading: boolean;
}) {
  const isExecuting = useExecutingToolCallIds().isExecuting(tool.toolCallId);
  const C = Tools[tool.toolName];

  return (
    <div className="flex flex-col gap-1">
      {C ? (
        <C
          tool={tool}
          isExecuting={isExecuting}
          sendMessage={sendMessage}
          isLoading={isLoading}
        />
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
