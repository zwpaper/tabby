import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/lib/stores/settings-store";

const CountdownInterval = 1000; // ms

// fibonacci sequence starting from 1, 2, 3, 5, 8...
function fib(n: number): number {
  if (n <= 1) {
    return n + 1;
  }
  return fib(n - 1) + fib(n - 2);
}

function getRetryDelay(attempts: number, limit: number) {
  if (attempts > limit) {
    return undefined;
  }
  return fib(attempts + 2);
}

interface RetryCount {
  error: Error;
  count: number;
}

export interface PendingRetryApproval {
  name: "retry";
  error: Error;

  // already failed attempts, including the first and retry attempts
  attempts: number;

  // auto-retry delay in seconds, undefined if auto-retry not available
  delay: number | undefined;
  // countdown (from number of delay to 0) in seconds, updated every second,
  // undefined if auto-retry not available or cancelled
  countdown: number | undefined;
  stopCountdown: () => void;
}

interface PendingRetry {
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

  // allowed retry times
  const limit = useMemo(() => {
    return autoApproveActive ? autoApproveSettings.retry : 0;
  }, [autoApproveActive, autoApproveSettings]);

  const increaseRetryCount = useCallback(() => {
    if (error === undefined) {
      return;
    }

    setRetryCount((current) => {
      if (current) {
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

  const pendingRetry = useMemo((): PendingRetry | undefined => {
    if (status === "streaming" || status === "submitted") {
      return undefined;
    }
    if (error) {
      const attempts = retryCount ? retryCount.count : 1;
      const delay = getRetryDelay(attempts, limit);
      return {
        error,
        attempts,
        delay,
      };
    }
    return undefined;
  }, [error, status, retryCount, limit]);

  const [countdown, setCountdown] = useState<number | undefined>(undefined);
  const pendingRetryInCountDown = useRef<PendingRetry | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (pendingRetry && pendingRetry !== pendingRetryInCountDown.current) {
      clearTimer();
      const { delay } = pendingRetry;
      setCountdown(delay);
      pendingRetryInCountDown.current = pendingRetry;
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
    if (!pendingRetry) {
      clearTimer();
    }
  }, [pendingRetry]);

  const clearTimer = useCallback(() => {
    clearInterval(timer.current);
    timer.current = undefined;
    pendingRetryInCountDown.current = undefined;
    setCountdown(undefined);
  }, []);

  const pendingApproval = useMemo((): PendingRetryApproval | undefined => {
    if (pendingRetry) {
      return {
        name: "retry",
        error: pendingRetry.error,
        attempts: pendingRetry.attempts,
        delay: pendingRetry.delay,
        countdown: countdown,
        stopCountdown: () => {
          clearTimer();
        },
      };
    }
    return undefined;
  }, [pendingRetry, countdown, clearTimer]);

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
  useEffect(() => {
    if (pendingApproval.countdown === 0) {
      doRetry();
    }
  }, [pendingApproval]);

  const doRetry = useCallback(() => {
    pendingApproval.stopCountdown();
    retry();
  }, [retry, pendingApproval]);

  return (
    <>
      <Button onClick={doRetry}>
        {pendingApproval.attempts !== undefined &&
        pendingApproval.countdown !== undefined
          ? ` Auto-retry in ${pendingApproval.countdown}s`
          : "Retry"}
      </Button>
      {pendingApproval.countdown !== undefined && (
        <Button onClick={pendingApproval.stopCountdown} variant="secondary">
          Cancel
        </Button>
      )}
    </>
  );
};
