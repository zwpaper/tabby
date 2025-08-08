import type { UseChatHelpers } from "@ai-v5-sdk/react";
import type { Message } from "@ragdoll/livekit";
import { useCallback } from "react";
import { usePendingApproval } from "./use-pending-approval";
import { useMixinReadyForRetryError } from "./use-ready-for-retry-error";
import { useRetry } from "./use-retry";

export function useApprovalAndRetry({
  error,
  messages,
  status,
  regenerate,
  sendMessage,
  showApproval,
}: {
  showApproval: boolean;
} & Pick<
  UseChatHelpers<Message>,
  "error" | "messages" | "sendMessage" | "regenerate" | "status"
>) {
  const { pendingApproval, increaseRetryCount } = usePendingApproval({
    error: useMixinReadyForRetryError(messages, error),
    messages,
    status,
  });

  const retryImpl = useRetry({
    messages,
    sendMessage,
    regenerate,
  });

  const retry = useCallback(
    (error: Error) => {
      increaseRetryCount();
      retryImpl(error);
    },
    [retryImpl, increaseRetryCount],
  );

  if (!showApproval) {
    return {
      pendingApproval: undefined,
      retry: () => {},
    };
  }

  return { pendingApproval, retry };
}
