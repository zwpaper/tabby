import { type ToolUIPart, getToolName, isToolUIPart } from "@ai-v5-sdk/ai";
import type { ClientToolsType, ClientToolsV5 } from "@getpochi/tools";
import { isUserInputTool } from "@getpochi/tools";
import type { Message, UITools } from "@ragdoll/livekit";
import { useMemo } from "react";

export type PendingToolCallApproval =
  | {
      name: keyof ClientToolsType;
      tool: ToolUIPart<UITools>;
    }
  | {
      name: "batchCall";
      tools: ToolUIPart<UITools>[];
    };

export function usePendingToolCallApproval({
  error,
  messages,
}: { error?: Error; messages: Message[] }) {
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
        isToolUIPart(part) &&
        part.state === "input-available" &&
        !isUserInputTool(getToolName(part))
      ) {
        tools.push(part);
      }
    }

    if (tools.length === 1) {
      return {
        name: getToolName(tools[0]) as keyof typeof ClientToolsV5,
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
