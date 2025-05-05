import type { useChat } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import type { ToolInvocation } from "ai";
import { useCallback, useRef } from "react";
import { vscodeHost } from "../vscode";

export function useVSCodeTool({
  addToolResult,
}: { addToolResult: ReturnType<typeof useChat>["addToolResult"] }) {
  const executed = useRef(false);
  const abort = useRef(new AbortController());

  const abortTool = useCallback(() => {
    abort.current.abort();
  }, []);

  const executeTool = useCallback(
    async (tool: ToolInvocation) => {
      if (executed.current) {
        return;
      }

      executed.current = true;
      const result = await vscodeHost
        .executeToolCall(tool.toolName, tool.args, {
          toolCallId: tool.toolCallId,
          abortSignal: ThreadAbortSignal.serialize(abort.current.signal),
        })
        .catch((err) => ({
          error: `Failed to execute tool: ${err.message}`,
        }));

      if (!abort.current.signal.aborted) {
        addToolResult({
          toolCallId: tool.toolCallId,
          result,
        });
      }
    },
    [addToolResult],
  );
  const rejectTool = useCallback(
    async (tool: ToolInvocation) => {
      if (executed.current) {
        return;
      }
      executed.current = true;
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          error: "User rejected tool call",
        },
      });
    },
    [addToolResult],
  );
  return { executeTool, rejectTool, abortTool };
}
