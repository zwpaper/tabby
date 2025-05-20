import type { useChat } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import type { Todo } from "@ragdoll/server";
import type { ToolInvocation } from "ai";
import { useCallback, useRef } from "react";
import { vscodeHost } from "../vscode";

export function useVSCodeTool({
  updateTodos,
  addToolResult,
}: {
  addToolResult: ReturnType<typeof useChat>["addToolResult"];
  updateTodos: (todos: Todo[]) => void;
}) {
  const abort = useRef(new AbortController());

  const abortTool = useCallback(() => {
    abort.current.abort();
  }, []);

  const executeTool = useCallback(
    async (tool: ToolInvocation) => {
      if (tool.toolName === "todoWrite") {
        updateTodos(tool.args.todos);
        addToolResult({
          toolCallId: tool.toolCallId,
          result: {
            success: true,
          },
        });
        return;
      }

      let result = await vscodeHost
        .executeToolCall(tool.toolName, tool.args, {
          toolCallId: tool.toolCallId,
          abortSignal: ThreadAbortSignal.serialize(abort.current.signal),
        })
        .catch((err) => ({
          error: `Failed to execute tool: ${err.message}`,
        }));

      if (abort.current.signal.aborted && typeof result === "object") {
        result = {
          ...result,
          aborted: "Tool execution was aborted, the output may be incomplete.",
        };
      }

      addToolResult({
        toolCallId: tool.toolCallId,
        result,
      });
    },
    [addToolResult, updateTodos],
  );
  const rejectTool = useCallback(
    async (tool: ToolInvocation, error: string) => {
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          error,
        },
      });
    },
    [addToolResult],
  );
  return { executeTool, rejectTool, abortTool };
}
