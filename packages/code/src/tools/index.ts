import type { ToolCall } from "ai";
import { useState } from "react";
import { listFiles } from "./list-files";
import { readFile } from "./read-file";
import { searchFiles } from "./search-files";

async function invokeToolImpl(tool: { toolCall: ToolCall<string, unknown> }) {
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

async function invokeTool(tool: {
  toolCall: ToolCall<string, unknown>;
}) {
  return await safeCall(invokeToolImpl(tool));
}

export interface PendingTool {
  toolCallId: string;
  resolve: (approved: boolean) => void;
}

export function useOnToolCall() {
  const [pendingTool, setPendingToolApproval] = useState<PendingTool | null>(
    null,
  );

  const confirmTool = (approved: boolean) => {
    if (pendingTool) {
      pendingTool.resolve(approved);
      setPendingToolApproval(null);
    }
  };

  const onToolCall = async (tool: { toolCall: ToolCall<string, unknown> }) => {
    const promise = new Promise<boolean>((resolve) => {
      setPendingToolApproval({
        toolCallId: tool.toolCall.toolCallId,
        resolve,
      });
    });

    if (await promise) {
      return await invokeTool(tool);
    }

    return {
      error: "Tool usage is rejected.",
    };
  };

  return {
    onToolCall,
    pendingTool,
    confirmTool,
  };
}
