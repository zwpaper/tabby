import { useToolCallState } from "@/features/chat";
import { usePreviewToolCall } from "@/lib/hooks/use-preview-tool-call";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect } from "react";

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
}: { messages: UIMessage[]; addToolResult?: AddToolResultFunctionType }) {
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
}: { tool: ToolInvocation; addToolResult?: AddToolResultFunctionType }) {
  const { getToolCallState, setToolCallState } = useToolCallState();
  const { previewToolCall, error: previewToolCallError } = usePreviewToolCall();

  useEffect(() => {
    if (getToolCallState(tool.toolCallId) !== undefined) return;
    previewToolCall(tool);
  }, [tool, previewToolCall, getToolCallState]);

  useEffect(() => {
    if (
      previewToolCallError &&
      getToolCallState(tool.toolCallId) === undefined &&
      addToolResult
    ) {
      addToolResult({
        toolCallId: tool.toolCallId,
        result: {
          error: previewToolCallError,
        },
      });
      setToolCallState(tool.toolCallId, "rejected");
    }
  }, [
    previewToolCallError,
    addToolResult,
    getToolCallState,
    setToolCallState,
    tool.toolCallId,
  ]);
  return null;
}
