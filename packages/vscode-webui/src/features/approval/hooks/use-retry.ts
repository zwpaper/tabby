import type { UseChatHelpers } from "@ai-v5-sdk/react";
import { prompts } from "@ragdoll/common";
import type { Message } from "@ragdoll/livekit";
import { useCallback } from "react";
import { ReadyForRetryError } from "./use-ready-for-retry-error";

export function useRetry({
  messages,
  sendMessage,
  regenerate,
}: Pick<UseChatHelpers<Message>, "messages" | "sendMessage" | "regenerate">) {
  const retryRequest = useCallback(
    async (error: Error) => {
      if (messages.length === 0) {
        return;
      }

      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role !== "assistant") {
        return sendMessage(undefined);
      }

      if (
        error instanceof ReadyForRetryError &&
        error.kind === "no-tool-calls"
      ) {
        return sendMessage({
          text: prompts.createSystemReminder(
            "You should use tool calls to answer the question, for example, use attemptCompletion if the job is done, or use askFollowupQuestions to clarify the request.",
          ),
        });
      }

      if (
        error instanceof ReadyForRetryError &&
        (error.kind === "tool-calls" || error.kind === "ready")
      ) {
        return sendMessage(undefined);
      }

      return regenerate({
        messageId: lastMessage.id,
      });
    },
    [messages, sendMessage, regenerate],
  );

  return retryRequest;
}
