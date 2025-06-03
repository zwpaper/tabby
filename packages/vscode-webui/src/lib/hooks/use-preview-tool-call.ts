import { useToolCallState } from "@/features/chat";
import { vscodeHost } from "@/lib/vscode";
import type { ToolInvocation } from "ai";
import { useCallback, useState } from "react";

export function usePreviewToolCall() {
  const { getToolCallState } = useToolCallState();
  const [error, setError] = useState<string | undefined>(undefined);
  const previewToolCall = useCallback(
    async (tool: ToolInvocation) => {
      const { state, args, toolCallId, toolName } = tool;
      if (state === "result") return;
      if (getToolCallState(toolCallId) !== undefined) return;
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
    [getToolCallState],
  );
  return { error, previewToolCall };
}
