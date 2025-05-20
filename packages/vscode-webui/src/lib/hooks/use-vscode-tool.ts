import type { useChat } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import type { Todo } from "@ragdoll/server";
import type { ToolInvocation } from "ai";
import { useCallback, useRef } from "react";
import { vscodeHost } from "../vscode";

export function useVSCodeTool({
  todos,
  addToolResult,
}: {
  addToolResult: ReturnType<typeof useChat>["addToolResult"];
  todos: React.MutableRefObject<Todo[] | undefined>;
}) {
  const abort = useRef(new AbortController());

  const abortTool = useCallback(() => {
    abort.current.abort();
  }, []);

  const executeTool = useCallback(
    async (tool: ToolInvocation) => {
      if (tool.toolName === "todoWrite") {
        todos.current = mergeTodos(todos.current || [], tool.args.todos);
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
    [addToolResult, todos],
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

function mergeTodos(todos: Todo[], newTodos: Todo[]): Todo[] {
  const todoMap = new Map(todos.map((todo) => [todo.id, todo]));
  for (const newTodo of newTodos) {
    todoMap.set(newTodo.id, newTodo);
  }

  const ret = Array.from(todoMap.values());
  ret.sort((a, b) => {
    const priorityOrder = { low: 0, medium: 1, high: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  return ret;
}
