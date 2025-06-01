import { useExecutingToolCallIds } from "@/lib/stores/chat-state";
import { vscodeHost } from "@/lib/vscode";
import type { ToolInvocation } from "ai";
import { useCallback, useState } from "react";

export function usePreviewToolCall() {
  const { isExecuting } = useExecutingToolCallIds();
  const [error, setError] = useState<string | undefined>(undefined);
  const previewToolCall = useCallback(
    async (tool: ToolInvocation) => {
      const { state, args, toolCallId, toolName } = tool;
      if (isExecuting(toolCallId)) return;
      if (state === "result") return;
      const result = await vscodeHost.previewToolCall(toolName, args, {
        toolCallId,
        state,
      });
      if (result?.error && state === "call") {
        setError((prev) => {
          if (prev) return prev;
          return result.error;
        });
      }
    },
    [isExecuting],
  );
  return { error, previewToolCall };
}
