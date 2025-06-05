import { vscodeHost } from "@/lib/vscode";
import type { ToolInvocation } from "ai";
import { useCallback, useState } from "react";

export function usePreviewToolCall() {
  const [done, setDone] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const previewToolCall = useCallback(async (tool: ToolInvocation) => {
    const { state, args, toolCallId, toolName } = tool;
    const result = await vscodeHost.previewToolCall(toolName, args, {
      toolCallId,
      state,
    });
    if (state === "call") {
      if (result?.error) {
        setError((prev) => {
          if (prev) return prev;
          return result.error;
        });
      } else {
        setDone(true);
      }
    }
  }, []);
  return { error, done, previewToolCall };
}
