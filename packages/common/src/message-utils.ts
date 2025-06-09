import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
import type { UIMessage } from "ai";
import type { Parent, Root, Text } from "hast";
import { toText } from "hast-util-to-text";
import { rehype } from "rehype";
import { KnownTags } from "./constants";

function escapeUnknownXMLTags(message: string): string {
  const tagRegex = /<\/?([^\s>]+)[^>]*>/g;

  return message.replace(tagRegex, (match, tagName) => {
    if (KnownTags.includes(tagName)) {
      return match; // Keep known tags as is
    }
    return match.replace("<", "&lt;"); // Escape unknown tags
  });
}

export function parseTitle(title: string | null) {
  if (!title) return "(empty)";

  const formatXMLTags = (ast: Root) => {
    function processNode(node: Parent) {
      if (node.children) {
        for (const child of node.children) {
          if (child.type === "element" && child.tagName === "workflow") {
            const _child = child as unknown as Text;
            _child.type = "text";
            _child.value = `/${child.properties.id}`;
            child.children = [];
          }
          if (child.type === "element" && child.tagName === "file") {
            child.tagName = "span";
          }
        }

        for (const child of node.children) {
          processNode(child as Parent);
        }
      }
    }

    processNode(ast);
  };

  const hast = rehype().parse(escapeUnknownXMLTags(title));
  formatXMLTags(hast);
  return toText(hast).slice(0, 256);
}

export function hasAttemptCompletion(message: UIMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "attemptCompletion",
  );
}

export function isAssistantMessageWithNoToolCalls(message: UIMessage): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  const lastStepStartIndex = message.parts.reduce((lastIndex, part, index) => {
    return part.type === "step-start" ? index : lastIndex;
  }, -1);

  const lastStepToolInvocations = message.parts
    .slice(lastStepStartIndex + 1)
    .filter((part) => part.type === "tool-invocation");

  return message.parts.length > 0 && lastStepToolInvocations.length === 0;
}

export function isAssistantMessageWithEmptyParts(message: UIMessage): boolean {
  return message.role === "assistant" && message.parts.length === 0;
}

export function isAssistantMessageWithPartialToolCalls(lastMessage: UIMessage) {
  return (
    lastMessage.role === "assistant" &&
    lastMessage.parts.some(
      (part) =>
        part.type === "tool-invocation" &&
        part.toolInvocation.state === "partial-call",
    )
  );
}

export function prepareLastMessageForRetry(
  lastMessage: UIMessage,
): UIMessage | null {
  const message = {
    ...lastMessage,
    parts: [...lastMessage.parts],
  };

  do {
    if (isAssistantMessageWithCompletedToolCalls(message)) {
      return message;
    }

    if (isAssistantMessageWithNoToolCalls(message)) {
      return message;
    }

    const lastStepStartIndex = message.parts.findLastIndex(
      (part) => part.type === "step-start",
    );

    message.parts = message.parts.slice(0, lastStepStartIndex);
  } while (message.parts.length > 0);

  return null;
}
