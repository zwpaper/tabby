import type React from "react";

import type { PendingApproval } from "@/features/approval";
import { RetryApprovalButton } from "./retry-approval-button";
import { ToolCallApprovalButton } from "./tool-call-approval-button";

interface ApprovalButtonProps {
  pendingApproval?: PendingApproval;
  retry: () => void;
}

export const ApprovalButton: React.FC<ApprovalButtonProps> = ({
  pendingApproval,
  retry,
}) => {
  if (!pendingApproval) return null;

  return (
    <div className="flex gap-3 [&>button]:flex-1 [&>button]:rounded-sm">
      {pendingApproval.name === "retry" ? (
        <RetryApprovalButton pendingApproval={pendingApproval} retry={retry} />
      ) : (
        <ToolCallApprovalButton pendingApproval={pendingApproval} />
      )}
    </div>
  );
};
