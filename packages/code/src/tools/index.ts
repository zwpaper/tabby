import type { ToolCall } from "ai";
import { useState } from "react";
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

async function invokeTool(tool: {
  toolCall: ToolCall<string, unknown>;
}) {
  return await safeCall(invokeToolImpl(tool));
}

const ToolsExemptFromApproval = new Set([
  "listFiles",
  "readFile",
  "attemptCompletion",
  "askFollowupQuestion",
]);

export interface PendingTool {
  toolCallId: string;
  resolve: (approved: boolean) => void;
}

export interface PendingFollowupQuestion {
  toolCallId: string;
  resolve: (answer: string) => void;
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

  const [pendingFollowupQuestion, setPendingFollowupQuestion] =
    useState<PendingFollowupQuestion | null>(null);

  const submitAnswer = (answer: string) => {
    if (pendingFollowupQuestion) {
      pendingFollowupQuestion.resolve(answer);
      setPendingFollowupQuestion(null);
    }
  };

  const onToolCall = async (tool: { toolCall: ToolCall<string, unknown> }) => {
    if (tool.toolCall.toolName === "askFollowupQuestion") {
      const promise = new Promise<string>((resolve) => {
        setPendingFollowupQuestion({
          toolCallId: tool.toolCall.toolCallId,
          resolve,
        });
      });
      return await promise;
    }

    let approved = true;
    if (!ToolsExemptFromApproval.has(tool.toolCall.toolName)) {
      const promise = new Promise<boolean>((resolve) => {
        setPendingToolApproval({
          toolCallId: tool.toolCall.toolCallId,
          resolve,
        });
      });
      approved = await promise;
    }

    if (approved) {
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
    pendingFollowupQuestion,
    submitAnswer,
  };
}
