import type { UIMessage } from "ai";
import type React from "react";

import {
  type PendingRetryApproval,
  RetryApprovalButton,
  usePendingRetryApproval,
} from "./retry-approval-button";
import {
  type AddToolResultFunctionType,
  type PendingToolCallApproval,
  ToolCallApprovalButton,
  usePendingToolCallApproval,
} from "./tool-call-approval-button";

export type PendingApproval = PendingToolCallApproval | PendingRetryApproval;

export function usePendingApproval({
  error,
  messages,
  status,
}: {
  error?: Error;
  messages: UIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
}) {
  const { pendingApproval: pendingRetryApproval, increaseRetryCount } =
    usePendingRetryApproval({
      error,
      status,
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

interface ApprovalButtonProps {
  isLoading: boolean;
  pendingApproval?: PendingApproval;
  retry: () => void;
  addToolResult: AddToolResultFunctionType;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  executingToolCallId?: string;
  chatHasFinishedOnce: boolean;
}

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  isLoading,
  pendingApproval,
  retry,
  addToolResult,
  setIsExecuting,
  executingToolCallId,
  chatHasFinishedOnce,
}) => {
  if (isLoading || !pendingApproval) return null;

  return (
    <div className="flex gap-3 [&>button]:flex-1 [&>button]:rounded-sm">
      {pendingApproval.name === "retry" ? (
        <RetryApprovalButton pendingApproval={pendingApproval} retry={retry} />
      ) : (
        <ToolCallApprovalButton
          pendingApproval={pendingApproval}
          addToolResult={addToolResult}
          setIsExecuting={setIsExecuting}
          executingToolCallId={executingToolCallId}
          chatHasFinishedOnce={chatHasFinishedOnce}
        />
      )}
    </div>
  );
};

// Helper function
export function pendingApprovalKey(
  pendingApproval: PendingApproval | undefined,
): string | undefined {
  if (!pendingApproval) {
    return;
  }
  if (pendingApproval.name === "retry") {
    return "retry";
  }
  return pendingApproval.tool.toolCallId;
}

export function getDisplayError(
  pendingApproval: PendingApproval | undefined,
): Error | undefined {
  if (pendingApproval?.name === "retry") {
    return pendingApproval.error;
  }
  return undefined;
}
