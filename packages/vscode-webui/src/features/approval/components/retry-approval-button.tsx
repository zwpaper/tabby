import type React from "react";
import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import type { PendingRetryApproval } from "@/features/approval/hooks/use-pending-retry-approval";
import { ReadyForRetryError } from "@/features/approval/hooks/use-ready-for-retry-error";
// usePendingRetryApproval is not directly used here anymore, it's used by usePendingApproval

interface RetryApprovalButtonProps {
  pendingApproval: PendingRetryApproval;
  retry: () => void;
}

export const RetryApprovalButton: React.FC<RetryApprovalButtonProps> = ({
  pendingApproval,
  retry,
}) => {
  useEffect(() => {
    if (pendingApproval.countdown === 0) {
      doRetry();
    }
  }, [pendingApproval]);

  const doRetry = useCallback(() => {
    pendingApproval.stopCountdown();
    retry();
  }, [retry, pendingApproval]);

  const isNoToolCalls =
    pendingApproval.error instanceof ReadyForRetryError &&
    pendingApproval.error.kind === "no-tool-calls";
  const autoRetryText = isNoToolCalls ? "Continue" : "Auto-retry";
  const retryText = isNoToolCalls ? "Continue" : "Retry";

  return (
    <>
      <Button onClick={doRetry}>
        {pendingApproval.attempts !== undefined &&
        pendingApproval.countdown !== undefined
          ? `${autoRetryText} in ${pendingApproval.countdown}s`
          : retryText}
      </Button>
      {pendingApproval.countdown !== undefined && (
        <Button onClick={pendingApproval.stopCountdown} variant="secondary">
          Cancel
        </Button>
      )}
    </>
  );
};
