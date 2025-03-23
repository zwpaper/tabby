import type { ToolCall } from "ai";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";

async function onToolCallImpl(tool: { toolCall: ToolCall<string, unknown> }) {
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // biome-ignore lint/suspicious/noExplicitAny: external call without type information
  const args: any = tool.toolCall.args;
  if (tool.toolCall.toolName === "listFiles") {
    return listFiles(args);
  }
  if (tool.toolCall.toolName === "readFile") {
    return readFile(args);
  }
  if (tool.toolCall.toolName === "searchFiles") {
    return searchFiles(args);
  }
  throw new Error(`${tool.toolCall.toolName} is not implemented`);
}

function safeCall<T>(x: Promise<T>) {
  return x.catch((e) => {
    return {
      error: e.message,
    };
  });
}

export async function onToolCall(tool: {
  toolCall: ToolCall<string, unknown>;
}) {
  return await safeCall(onToolCallImpl(tool));
}
