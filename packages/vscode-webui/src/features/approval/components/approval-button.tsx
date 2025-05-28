import type React from "react";

import type { PendingApproval } from "@/features/approval/hooks/use-pending-approval";
import { RetryApprovalButton } from "./retry-approval-button";
import {
  type AddToolResultFunctionType,
  ToolCallApprovalButton,
} from "./tool-call-approval-button";
// usePendingApproval is now imported by routes/_auth/index.tsx directly
// PendingRetryApproval and PendingToolCallApproval are part of PendingApproval type

interface ApprovalButtonProps {
  isLoading: boolean;
  pendingApproval?: PendingApproval;
  retry: () => void;
  addToolResult: AddToolResultFunctionType;
  addToolStreamResult: AddToolResultFunctionType;
  removeToolStreamResult: (toolCallId: string) => void;
  setIsExecuting: React.Dispatch<React.SetStateAction<boolean>>;
  executingToolCallId?: string;
}

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  isLoading,
  pendingApproval,
  retry,
  addToolResult,
  addToolStreamResult,
  removeToolStreamResult,
  setIsExecuting,
  executingToolCallId,
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
          addToolStreamResult={addToolStreamResult}
          removeToolStreamResult={removeToolStreamResult}
          setIsExecuting={setIsExecuting}
          executingToolCallId={executingToolCallId}
        />
      )}
    </div>
  );
};
