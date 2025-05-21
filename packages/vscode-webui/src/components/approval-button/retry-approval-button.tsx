import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/stores/settings-store";

// when auto-retry delay is less than 5s, only a loading indicator is displayed,
// otherwise error message and approval buttons will be displayed
const DelayThresholdToShowError = 5;

export function shouldShowLoadingForRetry(
  pendingApproval: PendingRetryApproval,
): boolean {
  return (
    pendingApproval.delay !== undefined &&
    pendingApproval.delay < DelayThresholdToShowError
  );
}

export function shouldShowErrorForRetry(
  pendingApproval: PendingRetryApproval,
): boolean {
  return !shouldShowLoadingForRetry(pendingApproval);
}

const CountdownInterval = 1000; // ms

// fibonacci sequence starting from 1, 2, 3, 5, 8...
function fib(n: number): number {
  if (n <= 1) {
    return n + 1;
  }
  return fib(n - 1) + fib(n - 2);
}

function getRetryDelay(attempts: number, limit: number) {
  if (attempts >= limit) {
    return undefined;
  }
  return fib(attempts);
}

function isSameError(a: Error, b: Error) {
  return a.name === b.name && a.message === b.message;
}

interface RetryCount {
  error: Error;
  count: number;
}

export interface PendingRetryApproval {
  name: "retry";
  error: Error;
  attempts: number;
  delay: number | undefined;
}

export function usePendingRetryApproval({
  error,
  status,
}: { error?: Error; status: "submitted" | "streaming" | "ready" | "error" }) {
  const { autoApproveActive, autoApproveSettings } = useSettingsStore();
  const [retryCount, setRetryCount] = useState<RetryCount | undefined>(
    undefined,
  );

  const limit = useMemo(() => {
    return autoApproveActive ? autoApproveSettings.retry : 0;
  }, [autoApproveActive, autoApproveSettings]);

  const increaseRetryCount = useCallback(() => {
    if (error === undefined) {
      return;
    }

    setRetryCount((current) => {
      if (current && isSameError(current.error, error)) {
        return {
          error: current.error,
          count: current.count + 1,
        };
      }
      return {
        error: error,
        count: 1,
      };
    });
  }, [error]);

  useEffect(() => {
    // reset retry count when status is ok
    if (status === "ready") {
      setRetryCount(undefined);
    }
  }, [status]);

  useEffect(() => {
    // reset retry count when settings updated to enable auto-retry
    if (limit > 0) {
      setRetryCount(undefined);
    }
  }, [limit]);

  const pendingApproval = useMemo((): PendingRetryApproval | undefined => {
    if (error) {
      const attempts =
        retryCount && isSameError(retryCount.error, error)
          ? retryCount.count
          : 0;
      const delay = getRetryDelay(attempts, limit);
      return {
        name: "retry",
        error,
        attempts,
        delay,
      };
    }
    return undefined;
  }, [error, retryCount, limit]);

  return { pendingApproval, increaseRetryCount };
}

interface RetryApprovalButtonProps {
  pendingApproval: PendingRetryApproval;
  retry: () => void;
}

export const RetryApprovalButton: React.FC<RetryApprovalButtonProps> = ({
  pendingApproval,
  retry,
}) => {
  const [countdown, setCountdown] = useState<number | undefined>(undefined);
  const pendingApprovalInCountDown = useRef<PendingRetryApproval | undefined>(
    undefined,
  );
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (
      pendingApproval &&
      pendingApproval !== pendingApprovalInCountDown.current
    ) {
      clearTimer();
      const { delay } = pendingApproval;
      setCountdown(delay);
      pendingApprovalInCountDown.current = pendingApproval;
      if (delay !== undefined) {
        timer.current = setInterval(() => {
          setCountdown((countdown) => {
            if (countdown !== undefined && countdown > 0) {
              return countdown - 1;
            }
            return countdown;
          });
        }, CountdownInterval);
      }
    }
    if (!pendingApproval) {
      clearTimer();
    }
  }, [pendingApproval]);

  const clearTimer = useCallback(() => {
    clearInterval(timer.current);
    timer.current = undefined;
    pendingApprovalInCountDown.current = undefined;
    setCountdown(undefined);
  }, []);

  useEffect(() => {
    if (countdown === 0) {
      doRetry();
    }
  }, [countdown]);

  const doRetry = useCallback(() => {
    clearTimer();
    retry();
  }, [retry, clearTimer]);

  return (
    <>
      {shouldShowErrorForRetry(pendingApproval) && (
        <>
          <Button onClick={doRetry}>
            Retry
            {pendingApproval.attempts > 1
              ? ` (Attempts: ${pendingApproval.attempts})`
              : ""}
          </Button>
          {countdown !== undefined && timer.current !== undefined && (
            <Button onClick={clearTimer} variant="secondary">
              Cancel {` (Auto-retry in ${countdown}s)`}
            </Button>
          )}
        </>
      )}
    </>
  );
};
