import type { ExecuteCommandInputType } from "@ragdoll/tools";
import type { Message, ToolCall, ToolInvocation } from "ai";
import { useEffect, useRef, useState } from "react";
import { applyDiff } from "./apply-diff";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { writeToFile } from "./write-to-file";

// biome-ignore lint/suspicious/noExplicitAny: external call without type information
const ToolMap: Record<string, (args: any) => Promise<unknown>> = {
  listFiles,
  globFiles,
  readFile,
  searchFiles,
  applyDiff,
  executeCommand,
  writeToFile,
};

async function invokeToolImpl(tool: { toolCall: ToolCall<string, unknown> }) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const toolFunction = ToolMap[tool.toolCall.toolName];
  if (!toolFunction) {
    throw new Error(`${tool.toolCall.toolName} is not implemented`);
  }

  return toolFunction(tool.toolCall.args);
}

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message,
    };
  });
}

export async function invokeTool(tool: {
  toolCall: ToolCall<string, unknown>;
}) {
  return await safeCall(invokeToolImpl(tool));
}

type Approval = "approved" | "rejected" | "pending";

interface UseExecuteToolParams {
  toolCall: ToolInvocation;
  addToolResult: (args: { toolCallId: string; result: unknown }) => void;
}

export function useExecuteTool({
  toolCall,
  addToolResult,
}: UseExecuteToolParams) {
  const { toolName, toolCallId, state } = toolCall;
  let defaultApproval: Approval =
    ToolsExemptFromApproval.has(toolName) || state === "result"
      ? "approved"
      : "pending";
  if (toolName === "executeCommand") {
    if ((toolCall.args as ExecuteCommandInputType).requiresApproval) {
      defaultApproval = "pending";
    } else {
      defaultApproval = "approved";
    }
  }

  const [approval, setApproval] = useState<Approval>(defaultApproval);

  const approveTool = (approved: boolean) => {
    setApproval(approved ? "approved" : "rejected");
  };

  const invokeToolTriggered = useRef(false);

  useEffect(() => {
    if (state === "result") return;

    if (UserInputTools.has(toolName)) {
      return;
    }

    if (approval === "pending") {
      return;
    }

    if (invokeToolTriggered.current) {
      return;
    }

    if (state === "call") {
      invokeToolTriggered.current = true;
      if (approval === "approved") {
        invokeTool({ toolCall }).then((result) => {
          addToolResult({ toolCallId, result });
        });
      } else if (approval === "rejected") {
        addToolResult({
          toolCallId,
          result: { error: "User rejected tool usage" },
        });
      }
    }
  }, [approval, toolName, toolCallId, toolCall, state, addToolResult]);

  return {
    approval,
    approveTool,
  };
}

const UserInputTools = new Set(["askFollowupQuestion", "attemptCompletion"]);

const ToolsExemptFromApproval = new Set([
  ...UserInputTools,
  "listFiles",
  "globFiles",
  "readFile",
  "searchFiles",
]);

export function useIsUserInputTools({
  messages,
}: {
  messages: Message[];
}) {
  let isUserInputTools = false;
  for (const message of messages) {
    const parts = message.parts || [];
    for (const part of parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call"
      ) {
        const { toolName } = part.toolInvocation;
        if (UserInputTools.has(toolName)) {
          isUserInputTools = true;
        }
      }
    }
  }

  return {
    isUserInputTools,
  };
}

export function prepareMessages(messages: Message[]) {
  return messages.map((message) => {
    if (message.role === "assistant" && message.parts) {
      for (let i = 0; i < message.parts.length; i++) {
        const part = message.parts[i];
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result"
        ) {
          part.toolInvocation = {
            ...part.toolInvocation,
            state: "result",
            result: UserInputTools.has(part.toolInvocation.toolName)
              ? { success: true }
              : {
                  error: "User cancelled the tool call.",
                },
          };
        }
      }
    }
    return message;
  });
}
