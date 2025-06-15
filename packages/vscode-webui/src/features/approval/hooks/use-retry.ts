import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import { prompts } from "@ragdoll/common";
import { prepareLastMessageForRetry } from "@ragdoll/common/message-utils";
import { useCallback } from "react";
import { ReadyForRetryError } from "./use-ready-for-retry-error";

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
  const retryRequest = useCallback(
    async (error: Error) => {
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

      if (
        error instanceof ReadyForRetryError &&
        error.kind === "no-tool-calls"
      ) {
        return await append({
          role: "user",
          content: prompts.createUserReminder(
            "You should use tool calls to answer the question, for example, use attemptCompletion if the job is done, or use askFollowupQuestions to clarify the request.",
          ),
        });
      }

      setMessages(messages.slice(0, -1));
      const lastMessageForRetry = prepareLastMessageForRetry(lastMessage);
      if (lastMessageForRetry != null) {
        return await append(lastMessageForRetry);
      }

      return await reload();
    },
    [messages, setMessages, append, reload, experimental_resume],
  );

  return retryRequest;
}
