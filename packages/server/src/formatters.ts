import { isUserInputTool } from "@ragdoll/tools";
import type { UIMessage } from "ai";
import { clone } from "remeda";
import { stripReadEnvironment } from "./prompts/environment";

function resolvePendingToolCalls(messages: UIMessage[]): UIMessage[] {
  return messages.map((message, index) => {
    if (index < messages.length - 1 && message.role === "assistant") {
      const parts = message.parts.map((part) => {
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state !== "result"
        ) {
          return {
            ...part,
            toolInvocation: {
              ...part.toolInvocation,
              state: "result",
              result: {
                error: isUserInputTool(part.toolInvocation.toolName)
                  ? { success: true }
                  : "User cancelled the tool call.",
              },
            },
          } satisfies UIMessage["parts"][number];
        }
        return part;
      });
      return {
        ...message,
        parts,
      };
    }

    return message;
  });
}

function removeDeprecatedToolInvocations(messages: UIMessage[]): UIMessage[] {
  return messages.map((message) => {
    message.toolInvocations = undefined;
    return message;
  });
}

type FormatOp = (messages: UIMessage[]) => UIMessage[];
const LLMFormatOps: FormatOp[] = [resolvePendingToolCalls];
const UIFormatOps = [resolvePendingToolCalls];
const StorageFormatOps = [
  stripReadEnvironment,
  removeDeprecatedToolInvocations,
];

function formatMessages(messages: UIMessage[], ops: FormatOp[]): UIMessage[] {
  // Clone the messages to avoid mutating the original array.
  return ops.reduce((acc, op) => op(acc), clone(messages));
}

export const formatters = {
  // Format messages for the Front-end UI rendering.
  ui: (messages: UIMessage[]) => formatMessages(messages, UIFormatOps),

  // Format messages before sending them to the LLM.
  llm: (messages: UIMessage[]) => formatMessages(messages, LLMFormatOps),

  // Format messages before storing them in the database.
  storage: (messages: UIMessage[]) =>
    formatMessages(messages, StorageFormatOps),
};
