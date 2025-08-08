import { useEffect, useRef } from "react";

import { ReadyForRetryError } from "@/features/approval";
import type { Task } from "@ragdoll/livekit";

interface UseEventAutoStartOptions {
  task?: Task;
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
