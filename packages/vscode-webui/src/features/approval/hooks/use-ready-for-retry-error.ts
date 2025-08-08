import { isAssistantMessageWithCompletedToolCalls } from "@ai-sdk/ui-utils";
// FIXME(meng): migrate these to v5
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
  isAssistantMessageWithPartialToolCalls,
} from "@ragdoll/common/message-utils";
import type { Message } from "@ragdoll/livekit";
import { toV4UIMessage } from "@ragdoll/livekit/v4-adapter";
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
  messages: Message[],
  error?: Error,
): Error | undefined {
  const readyForRetryError = useMemo(() => {
    const lastMessage = messages.at(-1);
    if (!lastMessage) return;
    if (lastMessage.role === "user") return new ReadyForRetryError();
    const lastMessageV4 = toV4UIMessage(lastMessage);

    if (isAssistantMessageWithEmptyParts(lastMessageV4)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithPartialToolCalls(lastMessageV4)) {
      return new ReadyForRetryError();
    }

    if (isAssistantMessageWithCompletedToolCalls(lastMessageV4)) {
      return new ReadyForRetryError("tool-calls");
    }

    if (isAssistantMessageWithNoToolCalls(lastMessageV4)) {
      return new ReadyForRetryError("no-tool-calls");
    }
  }, [messages]);

  return error || readyForRetryError;
}
