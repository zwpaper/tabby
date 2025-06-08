import type { InferResponseType } from "hono/client";
import { useEffect, useRef } from "react";

import { ReadyForRetryError } from "@/features/approval";
import type { apiClient } from "@/lib/auth-client";

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)[":id"]["$get"]>
>;

interface UseEventAutoStartOptions {
  task: Task | null;
  retry: (error: Error) => void;
  enabled: boolean;
}

export const usePendingModelAutoStart = ({
  task,
  retry,
  enabled,
}: UseEventAutoStartOptions) => {
  const init = task?.status === "pending-model";

  const initStarted = useRef(false);
  useEffect(() => {
    if (enabled && init && !initStarted.current) {
      initStarted.current = true;
      retry(new ReadyForRetryError("ready"));
    }
  }, [init, retry, enabled]);
};
