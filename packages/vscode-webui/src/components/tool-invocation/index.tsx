import type { ToolInvocation } from "ai";
import { applyDiffTool } from "./tools/apply-diff";
import { AskFollowupQuestionTool } from "./tools/ask-followup-question";
import { AttemptCompletionTool } from "./tools/attempt-completion";
import { executeCommandTool } from "./tools/execute-command";
import { globFilesTool } from "./tools/glob-files";
import { listFilesTool } from "./tools/list-files";
import { readFileTool } from "./tools/read-file";
import { searchFilesTool } from "./tools/search-files";
import { writeToFileTool } from "./tools/write-to-file";
import type { ToolProps } from "./types";

export function ToolInvocationPart({
  tool,
  setInput,
  executingToolCallId,
}: {
  tool: ToolInvocation;
  setInput: (prompt: string) => void;
  executingToolCallId: string | undefined;
}) {
  const C = Tools[tool.toolName];
  return (
    <div className="flex flex-col gap-1">
      {C ? (
        <C
          tool={tool}
          isExecuting={tool.toolCallId === executingToolCallId}
          setInput={setInput}
        />
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
