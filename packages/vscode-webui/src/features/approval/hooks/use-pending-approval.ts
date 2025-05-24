import type { UIMessage } from "ai";
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
  autoApproveGuard,
}: {
  error?: Error;
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  autoApproveGuard: boolean;
}) {
  const { pendingApproval: pendingRetryApproval, increaseRetryCount } =
    usePendingRetryApproval({
      error,
      status,
      autoApproveGuard,
    });
  const {
    pendingApproval: pendingToolCallApproval,
    setIsExecuting,
    executingToolCallId,
  } = usePendingToolCallApproval({ error, messages });

  return {
    pendingApproval: pendingRetryApproval ?? pendingToolCallApproval,
    setIsExecuting,
    executingToolCallId,
    increaseRetryCount,
  };
}
