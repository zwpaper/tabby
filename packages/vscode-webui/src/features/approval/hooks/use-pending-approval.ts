import type { Message } from "@ragdoll/livekit";
import { toV4UIMessage } from "@ragdoll/livekit/v4-adapter";
import {
  type PendingRetryApproval,
  usePendingRetryApproval,
} from "./use-pending-retry-approval";
import {
  type PendingToolCallApproval,
  usePendingToolCallApproval,
} from "./use-pending-tool-call-approval";

export type PendingApproval = PendingToolCallApproval | PendingRetryApproval;

export function usePendingApproval({
  error,
  messages,
  status,
}: {
  error?: Error;
  messages: Message[];
  status: "submitted" | "streaming" | "ready" | "error";
}) {
  const { pendingApproval: pendingRetryApproval, increaseRetryCount } =
    usePendingRetryApproval({
      error,
      status,
    });
  const { pendingApproval: pendingToolCallApproval } =
    usePendingToolCallApproval({
      error,
      messages: messages.map(toV4UIMessage),
    });

  if (status === "streaming" || status === "submitted") {
    return {
      pendingApproval: undefined,
      increaseRetryCount: () => {},
    };
  }

  return {
    pendingApproval: pendingRetryApproval ?? pendingToolCallApproval,
    increaseRetryCount,
  };
}
