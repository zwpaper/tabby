import type { useChat } from "@ai-sdk/react";
import { ThreadAbortSignal } from "@quilted/threads";
import {
  type ThreadSignalSerialization,
  threadSignal,
} from "@quilted/threads/signals";
import type { ShellExecutionResult } from "@ragdoll/vscode-webui-bridge";
import type { ToolInvocation } from "ai";
import { useCallback, useEffect, useRef } from "react";
import { vscodeHost } from "../vscode";

export function useVSCodeTool({
  addToolResult,
  addToolStreamResult,
  removeToolStreamResult,
  setIsExecuting,
}: {
  addToolResult: ReturnType<typeof useChat>["addToolResult"];
  addToolStreamResult: ReturnType<typeof useChat>["addToolResult"];
  removeToolStreamResult: (toolCallId: string) => void;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const abort = useRef(new AbortController());
  useUnmountOnce(() => {
    abort.current.abort();
  });

  const abortTool = useCallback(() => {
    abort.current.abort();
  }, []);

  const handleStreamResult = useCallback(
    (tool: ToolInvocation, result: unknown) => {
      threadSignal(
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
        (result as any)
          .output as ThreadSignalSerialization<ShellExecutionResult>,
      ).subscribe((output) => {
        if (output.status === "completed") {
          addToolResult({
            toolCallId: tool.toolCallId,
            result: {
              output: output.content,
              isTruncated: output.isTruncated ?? false,
              aborted: output.aborted,
            },
          });
          removeToolStreamResult(tool.toolCallId);
          setIsExecuting(false);
        } else {
          addToolStreamResult({
            toolCallId: tool.toolCallId,
            result: {
              output: output.content,
              isTruncated: output.isTruncated ?? false,
            },
          });
          setIsExecuting(true);
        }
      });
    },
    [
      setIsExecuting,
      addToolResult,
      addToolStreamResult,
      removeToolStreamResult,
    ],
  );

  const executeTool = useCallback(
    async (tool: ToolInvocation) => {
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
        !tool.args?.isDevServer &&
        typeof result === "object" &&
        result !== null &&
        "output" in result
      ) {
        handleStreamResult(tool, result);
        return;
      }

      addToolResult({
        toolCallId: tool.toolCallId,
        result,
      });
    },
    [addToolResult, handleStreamResult],
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
