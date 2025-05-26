import type { CreateMessage } from "ai";
import { useEffect, useRef } from "react";

interface UseAppendInitMessageProps {
  taskId: number | undefined;
  initMessage: CreateMessage | undefined;
  isModelsLoading: boolean;
  append: (message: CreateMessage) => void;
}

/**
 * Custom hook to handle initial message sending logic
 * Sends the initial message when conditions are met:
 * - No task ID (new chat)
 * - Models are loaded
 * - Initial message exists
 * - Message hasn't been sent yet
 */
export function useAppendInitMessage({
  taskId,
  initMessage,
  isModelsLoading,
  append,
}: UseAppendInitMessageProps) {
  const initMessageSent = useRef<boolean>(false);

  useEffect(() => {
    if (
      taskId === undefined &&
      // Requires models to be loaded before sending the initial message
      !isModelsLoading &&
      initMessage &&
      !initMessageSent.current
    ) {
      initMessageSent.current = true;
      append(initMessage);
    }
  }, [initMessage, isModelsLoading, append, taskId]);
}
