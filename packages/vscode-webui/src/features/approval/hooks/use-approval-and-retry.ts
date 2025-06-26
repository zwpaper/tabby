import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/ui-utils";
import type { MutableRefObject } from "react";
import { useCallback } from "react";
import { usePendingApproval } from "./use-pending-approval";
import { useMixinReadyForRetryError } from "./use-ready-for-retry-error";
import { useRetry } from "./use-retry";

export function useApprovalAndRetry({
  error,
  messages,
  status,
  append,
  setMessages,
  reload,
  experimental_resume,
  latestHttpCode,
  showApproval,
}: {
  error: Error | undefined;
  messages: UIMessage[];
  status: UseChatHelpers["status"];
  append: UseChatHelpers["append"];
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  experimental_resume: UseChatHelpers["experimental_resume"];
  latestHttpCode: MutableRefObject<number | undefined>;
  showApproval: boolean;
}) {
  const { pendingApproval, increaseRetryCount } = usePendingApproval({
    error: useMixinReadyForRetryError(messages, error),
    messages,
    status,
  });

  const retryImpl = useRetry({
    messages,
    append,
    setMessages,
    reload,
    experimental_resume,
    latestHttpCode,
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
