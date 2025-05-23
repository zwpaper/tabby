import type { ClientToolsType } from "@ragdoll/tools";
import { isUserInputTool } from "@ragdoll/tools";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";

export interface PendingToolCallApproval {
  name: keyof ClientToolsType;
  tool: ToolInvocation;
}

export function usePendingToolCallApproval({
  error,
  messages,
}: { error?: Error; messages: UIMessage[] }) {
  const [isExecuting, setIsExecuting] = useState(false);

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

  const executingToolCallId = useMemo(() => {
    if (pendingApproval && isExecuting) {
      return pendingApproval.tool.toolCallId;
    }
    return undefined;
  }, [pendingApproval, isExecuting]);

  // Reset isExecuting when pendingApproval changes or disappears
  useEffect(() => {
    if (!pendingApproval) {
      setIsExecuting(false);
    }
  }, [pendingApproval]);

  return { pendingApproval, setIsExecuting, executingToolCallId };
}
