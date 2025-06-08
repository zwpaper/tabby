import type React from "react";
import { useCallback, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import type { PendingRetryApproval } from "../hooks/use-pending-retry-approval";
import { ReadyForRetryError } from "../hooks/use-ready-for-retry-error";

interface RetryApprovalButtonProps {
  pendingApproval: PendingRetryApproval;
  retry: (error: Error) => void;
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
    retry(pendingApproval.error);
  }, [retry, pendingApproval]);

  const isReadyToolCalls =
    pendingApproval.error instanceof ReadyForRetryError &&
    pendingApproval.error.kind === "tool-calls";
  const autoRetryText = isReadyToolCalls ? "Auto-retry" : "Continue";
  const retryText = isReadyToolCalls ? "Retry" : "Continue";

  const [showRetry, setShowRetry] = useDebounceState(false, 500);
  useEffect(() => {
    setShowRetry(true);
  }, [setShowRetry]);

  if (!showRetry) return null;

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
