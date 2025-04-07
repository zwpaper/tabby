import type { ToolProps } from "@/components/tool-box/types";
import { invokeTool } from "@/lib/tools";
import type { useChat } from "@ai-sdk/react";
import { useCallback, useRef, useState } from "react";

export function useRunningToolCall(
  addToolResult: ReturnType<typeof useChat>["addToolResult"],
) {
  const abortController = useRef<AbortController | null>(null);
  const [runningToolCall, setRunningToolCall] = useState<
    ToolProps["toolCall"] | null
  >(null);
  const hasRunningToolCall = !!runningToolCall;

  const onToolCall = useCallback(
    async (toolCall: ToolProps["toolCall"], approved: boolean) => {
      if (runningToolCall) {
        return;
      }

      if (approved) {
        abortController.current = new AbortController();
        setRunningToolCall(toolCall);
        const result = await invokeTool({
          toolCall,
          signal: abortController.current.signal,
        });
        addToolResult({ toolCallId: toolCall.toolCallId, result });
        setRunningToolCall(null);
        abortController.current = null; // Clear controller after use
      } else {
        addToolResult({
          toolCallId: toolCall.toolCallId,
          result: { error: "User rejected tool usage" },
        });
      }
    },
    [runningToolCall, addToolResult],
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
