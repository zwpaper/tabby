import type { ToolProps } from "@/components/tool-box/types";
import { invokeTool } from "@/lib/tools";
import { useCallback, useRef, useState } from "react";

export function useRunningToolCall(
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: unknown;
  }) => Promise<void>,
) {
  const abortController = useRef<AbortController | null>(null);
  const [runningToolCall, setRunningToolCall] = useState<
    ToolProps["toolCall"] | null
  >(null);
  const hasRunningToolCall = !!runningToolCall;

  const onToolCall = useCallback(
    async (
      toolCall: ToolProps["toolCall"] & { _invoked?: boolean },
      approved: boolean,
    ) => {
      if (approved) {
        abortController.current = new AbortController();
        setRunningToolCall(toolCall);
        const result = await invokeTool({
          toolCall,
          signal: abortController.current.signal,
        });
        await addToolResult({ toolCallId: toolCall.toolCallId, result });
        abortController.current = null; // Clear controller after use
        setRunningToolCall(null);
      } else {
        await addToolResult({
          toolCallId: toolCall.toolCallId,
          result: { error: "User rejected tool usage" },
        });
      }
    },
    [addToolResult],
  );

  const abortToolCall = useCallback(() => {
    if (runningToolCall) {
      abortController.current?.abort();
      setRunningToolCall(null);
      abortController.current = null;
    }
  }, [runningToolCall]);

  return {
    runningToolCall,
    hasRunningToolCall,
    onToolCall,
    abortToolCall,
  };
}
