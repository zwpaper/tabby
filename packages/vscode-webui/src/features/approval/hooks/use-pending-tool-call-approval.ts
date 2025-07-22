import type { ClientToolsType } from "@getpochi/tools";
import { isUserInputTool } from "@getpochi/tools";
import type { ToolInvocation, UIMessage } from "ai";
import { useMemo } from "react";

export type PendingToolCallApproval =
  | {
      name: keyof ClientToolsType;
      tool: ToolInvocation;
    }
  | {
      name: "batchCall";
      tools: ToolInvocation[];
    };

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

    const tools = [];
    for (const part of lastMessage.parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call" &&
        !isUserInputTool(part.toolInvocation.toolName)
      ) {
        tools.push(part.toolInvocation);
      }
    }

    if (tools.length === 1) {
      return {
        name: tools[0].toolName as keyof ClientToolsType,
        tool: tools[0],
      };
    }

    if (tools.length > 1) {
      return {
        name: "batchCall",
        tools: tools,
      };
    }
    return undefined;
  }, [error, messages]);

  return { pendingApproval };
}
