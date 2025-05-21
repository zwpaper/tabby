import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
import { useCallback } from "react";

export function useRetry({
  messages,
  setMessages,
  append,
  reload,
  experimental_resume,
  latestHttpCode,
}: {
  messages: UIMessage[];
  append: UseChatHelpers["append"];
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  experimental_resume: UseChatHelpers["experimental_resume"];
  latestHttpCode: React.RefObject<number | undefined>;
}) {
  // biome-ignore lint/correctness/useExhaustiveDependencies(latestHttpCode.current): is ref.
  const retryRequest = useCallback(async () => {
    if (messages.length === 0) {
      return;
    }

    if (latestHttpCode.current === 409) {
      experimental_resume();
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "assistant") {
      return await reload();
    }

    setMessages(messages.slice(0, -1));
    const lastMessageForRetry = prepareLastMessageForRetry(lastMessage);
    if (lastMessageForRetry != null) {
      return await append(lastMessageForRetry);
    }

    return await reload();
  }, [messages, setMessages, append, reload, experimental_resume]);

  return retryRequest;
}

function prepareLastMessageForRetry(lastMessage: UIMessage): UIMessage | null {
  const message = {
    ...lastMessage,
    parts: [...lastMessage.parts],
  };

  do {
    if (isAssistantMessageWithCompletedToolCalls(message)) {
      return message;
    }

    const lastStepStartIndex = message.parts.findLastIndex(
      (part) => part.type === "step-start",
    );

    message.parts = message.parts.slice(0, lastStepStartIndex);
  } while (message.parts.length > 0);

  return null;
}

export function isReadyForRetry(messages: UIMessage[]): boolean {
  const lastMessage = messages.at(-1);
  if (!lastMessage) return false;
  if (lastMessage.role === "user") return true;
  if (
    lastMessage.role === "assistant" &&
    isAssistantMessageWithCompletedToolCalls(lastMessage)
  ) {
    return true;
  }

  return false;
}
