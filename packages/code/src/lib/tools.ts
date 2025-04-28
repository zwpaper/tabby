import { executeClientTool } from "@ragdoll/tools/node";
import type { ToolCall, ToolInvocation } from "ai";

export async function invokeTool(args: {
  toolCall: ToolCall<string, unknown>;
  abortSignal: AbortSignal;
}) {
  return executeClientTool(args.toolCall.toolName, args.toolCall.args, {
    messages: [],
    toolCallId: args.toolCall.toolCallId,
    abortSignal: args.abortSignal,
  });
}

export function isDefaultApproved(toolCall: ToolInvocation) {
  const { toolName, state } = toolCall;
  const defaultApproval: boolean =
    ToolsExemptFromApproval.has(toolName) || state === "result";
  return defaultApproval;
}

const ToolsExemptFromApproval = new Set([
  "listFiles",
  "globFiles",
  "readFile",
  "searchFiles",
]);
