import { type ToolFunctionType, isUserInputTool } from "@ragdoll/tools";
import type { ToolCall, ToolInvocation } from "ai";
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
  ToolFunctionType<any>
> = {
  listFiles,
  globFiles,
  readFile,
  searchFiles,
  applyDiff,
  executeCommand,
  writeToFile,
};

async function invokeToolImpl(args: {
  toolCall: ToolCall<string, unknown>;
  abortSignal: AbortSignal;
}) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const toolFunction = ToolMap[args.toolCall.toolName];
  if (!toolFunction) {
    throw new Error(`${args.toolCall.toolName} is not implemented`);
  }

  return await toolFunction(args.toolCall.args, {
    messages: [],
    toolCallId: args.toolCall.toolCallId,
    abortSignal: args.abortSignal,
  });
}

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message,
    };
  });
}

export async function invokeTool(args: {
  toolCall: ToolCall<string, unknown>;
  abortSignal: AbortSignal;
}) {
  return await safeCall(invokeToolImpl(args));
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
