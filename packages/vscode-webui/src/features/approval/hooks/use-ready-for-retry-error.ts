import type { UIMessage } from "@ai-sdk/ui-utils";
import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
import { useMemo } from "react";
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
} from "../utils";

type RetryKind = "retry" | "no-tool-calls";

export class ReadyForRetryError extends Error {
  kind: RetryKind;

  constructor(kind: RetryKind = "retry") {
    super();
    this.kind = kind;
  }
}

export function useReadyForRetryError(
  messages: UIMessage[],
): ReadyForRetryError | undefined {
  return useMemo(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return;
    if (lastMessage.role === "user") return new ReadyForRetryError();

    if (isAssistantMessageWithEmptyParts(lastMessage)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithCompletedToolCalls(lastMessage)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithNoToolCalls(lastMessage)) {
      return new ReadyForRetryError("no-tool-calls");
    }
  }, [messages]);
}
