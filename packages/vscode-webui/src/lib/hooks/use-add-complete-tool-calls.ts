import { useToolCallLifeCycle } from "@/features/chat";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { useEffect } from "react";

interface UseAddCompleteToolCallsProps {
  messages: UIMessage[];
  addToolResult?: (result: { toolCallId: string; result: unknown }) => void;
}

function isToolStateCall(message: UIMessage, toolCallId: string): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  for (const part of message.parts) {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.toolCallId === toolCallId
    ) {
      return part.toolInvocation.state === "call";
    }
  }

  return false;
}

export function useAddCompleteToolCalls({
  messages,
  addToolResult,
}: UseAddCompleteToolCallsProps): void {
  const { completeToolCalls } = useToolCallLifeCycle();

  useEffect(() => {
    if (!addToolResult || completeToolCalls.length === 0) return;

    const lastMessage = messages.at(messages.length - 1);
    if (!lastMessage) return;

    for (const toolCall of completeToolCalls) {
      if (isToolStateCall(lastMessage, toolCall.toolCallId)) {
        addToolResult({
          toolCallId: toolCall.toolCallId,
          result: toolCall.result,
        });
        toolCall.dispose();
      }
    }
  }, [completeToolCalls, messages, addToolResult]);
}
