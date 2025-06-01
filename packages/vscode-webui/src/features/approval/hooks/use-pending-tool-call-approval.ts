import type { ClientToolsType } from "@ragdoll/tools";
import { isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import { useMemo } from "react";

export interface PendingToolCallApproval {
  name: keyof ClientToolsType;
  tool: ToolInvocation;
}

export function usePendingToolCallApproval({
  error,
  messages,
}: { error?: Error; messages: UIMessage[] }) {
  const pendingApproval = useMemo((): PendingToolCallApproval | undefined => {
    if (error) {
      return undefined;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role !== "assistant") {
      return undefined;
    }

    for (const part of lastMessage.parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        !isUserInputTool(part.toolInvocation.toolName)
      ) {
        return {
          name: part.toolInvocation.toolName as keyof ClientToolsType,
          tool: part.toolInvocation,
        };
      }
    }
    return undefined;
  }, [error, messages]);

  return { pendingApproval };
}
