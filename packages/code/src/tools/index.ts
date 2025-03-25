import type { Message, ToolCall, ToolInvocation } from "ai";
import { useEffect, useRef, useState } from "react";
import { applyDiff } from "./apply-diff";
import { askFollowupQuestion } from "./ask-followup-question";
import { attemptCompletion } from "./attempt-completion";
import { executeCommand } from "./execute-command";
import { listCodeDefinitionNames } from "./list-code-definition-names";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { writeToFile } from "./write-to-file";

// biome-ignore lint/suspicious/noExplicitAny: external call without type information
const ToolMap: Record<string, (args: any) => Promise<unknown>> = {
  listFiles,
  readFile,
  searchFiles,
  applyDiff,
  executeCommand,
  askFollowupQuestion,
  attemptCompletion,
  listCodeDefinitionNames,
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
  const [approval, setApproval] = useState<Approval>(
    isToolExemptFromApproval(toolName) ? "approved" : "pending",
  );

  const approveTool = (approved: boolean) => {
    setApproval(approved ? "approved" : "rejected");
  };

  const invokeToolTriggered = useRef(false);

  useEffect(() => {
    if (isUserInteractiveTool(toolName)) {
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

const UserInteractiveTools = new Set(["askFollowupQuestion"]);

function isUserInteractiveTool(tool: string) {
  return UserInteractiveTools.has(tool);
}

const ToolsExemptFromApproval = new Set([
  ...UserInteractiveTools,
  "listFiles",
  "readFile",
  "attemptCompletion",
]);

export function isToolExemptFromApproval(tool: string) {
  return ToolsExemptFromApproval.has(tool);
}

export function useUserInteractionTools({ messages }: { messages: Message[] }) {
  let pendingApproval = false;
  let pendingFollowupQuestion = null;
  for (const message of messages) {
    const parts = message.parts || [];
    for (const part of parts) {
      if (
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "call"
      ) {
        const { toolName, toolCallId } = part.toolInvocation;
        if (!isToolExemptFromApproval(toolName)) {
          pendingApproval = true;
        }
        if (toolName === "askFollowupQuestion") {
          pendingFollowupQuestion = toolCallId;
        }
      }
    }
  }

  return {
    pendingApproval,
    pendingFollowupQuestion,
  };
}
