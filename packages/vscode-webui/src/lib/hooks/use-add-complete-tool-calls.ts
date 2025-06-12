import { type ToolCallLifeCycle, useToolCallLifeCycle } from "@/features/chat";
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
        const result = overrideResult(toolCall.complete);
        addToolResult({
          toolCallId: toolCall.toolCallId,
          result,
        });
        toolCall.dispose();
      }
    }
  }, [completeToolCalls, messages, addToolResult]);
}

function assertUnreachable(_x: never): never {
  throw new Error("Didn't expect to get here");
}

function overrideResult(complete: ToolCallLifeCycle["complete"]) {
  const { result, reason } = complete;
  if (typeof result !== "object") {
    return result;
  }

  // biome-ignore lint/suspicious/noExplicitAny: override external result
  const output: any = {
    ...(result as object),
  };

  // Use an switch clause so new reason will be caught by type checker.
  switch (reason) {
    case "user-abort":
      output.error =
        "User aborted the tool call, please use askFollowupQuestion to clarify next step with user.";
      break;
    case "user-reject":
      output.error =
        "User rejected the tool call, please use askFollowupQuestion to clarify next step with user.";
      break;
    case "user-detach":
      // We use info instead of error to avoid the tool call being marked as failed.
      output.info =
        "User has detached the terminal, the job will continue running in the background, please use askFollowupQuestion to clarify next step with user.";
      break;
    case "preview-reject":
    case "execute-finish":
      break;
    default:
      assertUnreachable(reason);
  }

  return output;
}
