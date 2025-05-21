import { vscodeHost } from "@/lib/vscode";
import type { ToolInvocation, UIMessage } from "ai";
import { useCallback, useEffect, useRef, useState } from "react";

type AddToolResultFunctionType = ({
  toolCallId,
  result,
}: {
  toolCallId: string;
  result: unknown;
}) => void;

export function PreviewTool({
  messages,
  addToolResult,
}: { messages: UIMessage[]; addToolResult: AddToolResultFunctionType }) {
  const lastMessage = messages.at(-1);
  const components = lastMessage?.parts?.map((part) => {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state !== "result"
    ) {
      return (
        <PreviewOneTool
          key={part.toolInvocation.toolCallId}
          tool={part.toolInvocation}
          addToolResult={addToolResult}
        />
      );
    }
  });
  return <>{components}</>;
}

function PreviewOneTool({
  tool,
  addToolResult,
}: { tool: ToolInvocation; addToolResult: AddToolResultFunctionType }) {
  const executed = useRef(false);
  const { previewToolCall, error: previewToolCallError } = usePreviewToolCall();
  useEffect(() => {
    previewToolCall(tool);
  }, [tool, previewToolCall]);

  useEffect(() => {
    if (previewToolCallError && !executed.current) {
      executed.current = true;
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          error: previewToolCallError,
        },
      });
    }
  });
  return null;
}

// Hook
function usePreviewToolCall() {
  const [error, setError] = useState<string | undefined>(undefined);
  const previewToolCall = useCallback(async (tool: ToolInvocation) => {
    const { state, args, toolCallId, toolName } = tool;
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
  }, []);
  return { error, previewToolCall };
}
