import { useToolCallLifeCycle } from "@/features/chat";
import type { UIMessage } from "@ai-sdk/ui-utils";
import {
  isAssistantMessageWithCompletedToolCalls,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import { useEffect, useRef } from "react";

interface UseVercelAiToolResultWorkaroundProps {
  messages: UIMessage[];
  setMessages: (messages: UIMessage[]) => void;
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

export function useVercelAiToolResultWorkaround({
  messages,
  setMessages,
  addToolResult,
}: UseVercelAiToolResultWorkaroundProps): void {
  const { completeToolCalls, clearToolCalls } = useToolCallLifeCycle();
  const addToolCallExecuted = useRef(true);

  useEffect(() => {
    const lastMessage = messages.at(messages.length - 1);
    if (!lastMessage || !addToolResult) return;

    let isDirty = false;
    for (const toolCall of completeToolCalls) {
      if (
        isToolStateCall(lastMessage, toolCall.toolCallId) &&
        toolCall.status === "complete"
      ) {
        isDirty = true;
        updateToolCallResult({
          messages,
          toolCallId: toolCall.toolCallId,
          toolResult: toolCall.result,
        });
      }
    }

    if (isDirty) {
      addToolCallExecuted.current = false;
      setMessages([]);
      setMessages([...messages]);
    } else if (
      !addToolCallExecuted.current &&
      isAssistantMessageWithCompletedToolCalls(lastMessage)
    ) {
      addToolCallExecuted.current = true;
      addToolResult({
        toolCallId: "not-exist-tool-call-to-trigger-submission",
        result: undefined,
      });
      clearToolCalls();
    }
  }, [completeToolCalls, setMessages, messages, addToolResult, clearToolCalls]);
}
