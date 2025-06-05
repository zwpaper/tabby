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
  const {
    previewToolCall,
    error: previewToolCallError,
    done: previewDone,
  } = usePreviewToolCall();

  useEffect(() => {
    if (getToolCallState(tool.toolCallId) === undefined) {
      setToolCallState(tool.toolCallId, "preview");
    }

    if (getToolCallState(tool.toolCallId) === "preview") {
      previewToolCall(tool);
    }
  }, [tool, previewToolCall, getToolCallState, setToolCallState]);

  useEffect(() => {
    if (addToolResult && getToolCallState(tool.toolCallId) === "preview") {
      if (previewToolCallError) {
        setToolCallState(tool.toolCallId, "rejected");
        addToolResult({
          toolCallId: tool.toolCallId,
          result: {
            error: previewToolCallError,
          },
        });
      }

      if (previewDone) {
        setToolCallState(tool.toolCallId, "ready");
      }
    }
  }, [
    previewToolCallError,
    addToolResult,
    setToolCallState,
    tool.toolCallId,
    getToolCallState,
    previewDone,
  ]);
  return null;
}
