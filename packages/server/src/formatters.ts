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

function stripKnownXMLTags(messages: UIMessage[]): UIMessage[] {
  const knownTags = ["file", "user-reminder"];
  return messages.map((message) => {
    const parts = message.parts.map((part) => {
      if (part.type === "text") {
        const text = knownTags.reduce((acc, tag) => {
          return acc.replace(
            new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "gs"),
            "$1",
          );
        }, part.text);
        return {
          ...part,
          text,
        };
      }
      return part;
    });
    return {
      ...message,
      parts,
    };
  });
}

function removeUserReminderMessage(messages: UIMessage[]): UIMessage[] {
  return messages.filter((message) => {
    if (message.role !== "user") return true;
    return !message.parts.some((part) => {
      if (part.type !== "text") return false;
      return (
        part.text.startsWith("<user-reminder>") &&
        part.text.endsWith("</user-reminder>")
      );
    });
  });
}

function combineConsecutiveAssistantMessages(
  messages: UIMessage[],
): UIMessage[] {
  for (let i = 0; i < messages.length - 1; i++) {
    if (
      messages[i].role === "assistant" &&
      messages[i + 1].role === "assistant"
    ) {
      messages[i].parts.push(...messages[i + 1].parts);
      messages.splice(i + 1, 1);
      i--;
    }
  }

  return messages;
}

type FormatOp = (messages: UIMessage[]) => UIMessage[];
const LLMFormatOps: FormatOp[] = [resolvePendingToolCalls, stripKnownXMLTags];
const UIFormatOps = [
  resolvePendingToolCalls,
  removeUserReminderMessage,
  combineConsecutiveAssistantMessages,
];
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
