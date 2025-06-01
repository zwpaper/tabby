import { usePreviewToolCall } from "@/lib/hooks/use-preview-tool-call";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect, useRef } from "react";

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
