import type { UIMessage } from "@ai-sdk/ui-utils";

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
