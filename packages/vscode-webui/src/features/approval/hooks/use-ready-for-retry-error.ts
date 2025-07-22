import type { UIMessage } from "@ai-sdk/ui-utils";
import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
  isAssistantMessageWithPartialToolCalls,
} from "@ragdoll/common/message-utils";
import { ServerErrors } from "@ragdoll/server";
import { useMemo } from "react";

type RetryKind = "ready" | "tool-calls" | "no-tool-calls";

export class ReadyForRetryError extends Error {
  kind: RetryKind;

  constructor(kind: RetryKind = "ready") {
    super();
    this.kind = kind;
  }
}

export function useMixinReadyForRetryError(
  messages: UIMessage[],
  error?: Error,
): Error | undefined {
  const readyForRetryError = useMemo(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return;
    if (lastMessage.role === "user") return new ReadyForRetryError();

    if (isAssistantMessageWithEmptyParts(lastMessage)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithPartialToolCalls(lastMessage)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithCompletedToolCalls(lastMessage)) {
      return new ReadyForRetryError("tool-calls");
    }

    if (isAssistantMessageWithNoToolCalls(lastMessage)) {
      return new ReadyForRetryError("no-tool-calls");
    }
  }, [messages]);

  if (
    error &&
    ![
      ServerErrors.ReachedCreditLimit,
      ServerErrors.RequireSubscription,
      ServerErrors.ReachedOrgCreditLimit,
      ServerErrors.RequireOrgSubscription,
    ].includes(error.message)
  ) {
    return error;
  }

  return readyForRetryError;
}
