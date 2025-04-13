import { isUserInputTool } from "@ragdoll/tools";
import type { Message, ToolCall, ToolInvocation } from "ai";
import { applyDiff } from "./apply-diff";
import { executeCommand } from "./execute-command";
import { globFiles } from "./glob-files";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";
import { writeToFile } from "./write-to-file";

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  (args: any, signal: AbortSignal) => Promise<unknown>
> = {
  listFiles,
  globFiles,
  readFile,
  searchFiles,
  applyDiff,
  executeCommand,
  writeToFile,
};

async function invokeToolImpl(tool: {
  toolCall: ToolCall<string, unknown>;
  signal: AbortSignal;
}) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const toolFunction = ToolMap[tool.toolCall.toolName];
  if (!toolFunction) {
    throw new Error(`${tool.toolCall.toolName} is not implemented`);
  }

  return await toolFunction(tool.toolCall.args, tool.signal);
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
  signal: AbortSignal;
}) {
  return await safeCall(invokeToolImpl(tool));
}

export function isDefaultApproved(toolCall: ToolInvocation) {
  const { toolName, state } = toolCall;
  const defaultApproval: boolean =
    isUserInputTool(toolName) ||
    ToolsExemptFromApproval.has(toolName) ||
    state === "result";
  return defaultApproval;
}

const ToolsExemptFromApproval = new Set([
  "listFiles",
  "globFiles",
  "readFile",
  "searchFiles",
]);

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
            result: isUserInputTool(part.toolInvocation.toolName)
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
