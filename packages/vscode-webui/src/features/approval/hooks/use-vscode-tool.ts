import { useExecutingToolCallIds } from "@/features/chat";
import { vscodeHost } from "@/lib/vscode";
import type { useChat } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import {
  type ThreadSignalSerialization,
  threadSignal,
} from "@quilted/threads/signals";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useRef } from "react";

export function useVSCodeTool({
  addToolResult,
  addToolStreamResult,
  removeToolStreamResult,
}: {
  addToolResult: ReturnType<typeof useChat>["addToolResult"];
  addToolStreamResult: ReturnType<typeof useChat>["addToolResult"];
  removeToolStreamResult: (toolCallId: string) => void;
}) {
  const abort = useRef(new AbortController());
  const { addExecutingToolCall, removeExecutingToolCall } =
    useExecutingToolCallIds();

  useUnmountOnce(() => {
    abort.current.abort();
  });

  const abortTool = useCallback(() => {
    abort.current.abort();
  }, []);

  const handleStreamResult = useCallback(
    (
      tool: ToolInvocation,
      result: {
        output: ThreadSignalSerialization<ExecuteCommandResult>;
        detach: () => void;
      },
    ) => {
      const signal = threadSignal(result.output);

      const unsubscribe = signal.subscribe((output) => {
        if (output.status === "completed") {
          const result: Record<string, unknown> = {
            output: output.content,
            isTruncated: output.isTruncated ?? false,
          };
          // do not set error property if it is undefined
          if (output.error) {
            result.error = output.error;
          }
          addToolResult({
            toolCallId: tool.toolCallId,
            result: {
              output: output.content,
              isTruncated: output.isTruncated ?? false,
              detach: output.detach,
              error: output.error,
            },
          });
          removeToolStreamResult(tool.toolCallId);
          removeExecutingToolCall(tool.toolCallId);
          unsubscribe();
        } else {
          addToolStreamResult({
            toolCallId: tool.toolCallId,
            result: {
              output: output.content,
              isTruncated: output.isTruncated ?? false,
              detach: result.detach,
            },
          });
        }
      });
    },
    [
      addToolResult,
      addToolStreamResult,
      removeToolStreamResult,
      removeExecutingToolCall,
    ],
  );

  const executeTool = useCallback(
    async (tool: ToolInvocation) => {
      addExecutingToolCall(tool.toolCallId);
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

      if (
        tool.toolName === "executeCommand" &&
        typeof result === "object" &&
        result !== null &&
        "output" in result
      ) {
        // biome-ignore lint/suspicious/noExplicitAny: external
        handleStreamResult(tool, result as any);

        // For streaming tools, addToolResult / removeExecutingToolCall is called in handleStreamResult
        return;
      }

      addToolResult({
        toolCallId: tool.toolCallId,
        result,
      });
      removeExecutingToolCall(tool.toolCallId);
    },
    [
      addToolResult,
      handleStreamResult,
      addExecutingToolCall,
      removeExecutingToolCall,
    ],
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

function useUnmountOnce(fn: () => void) {
  if (process.env.NODE_ENV === "development") {
    // We need to unmount twice in development mode because of React Strict Mode
    const unmountCountDown = useRef(2);

    // biome-ignore lint/correctness/useExhaustiveDependencies(fn): run once on unmount
    useEffect(() => {
      return () => {
        unmountCountDown.current--;
        if (unmountCountDown.current === 0) {
          fn();
        } else if (unmountCountDown.current < 0) {
          throw new Error("useUnmountOnce unmounted too many times");
        }
      };
    }, []);
  } else {
    // biome-ignore lint/correctness/useExhaustiveDependencies(fn): run once on unmount
    useEffect(() => {
      return () => {
        fn();
      };
    }, []);
  }
}
