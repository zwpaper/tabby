import { useCallback, useState } from "react";

// Hook to manage executing tool call IDs
export function useExecutingToolCalls() {
  const [executingToolCallIds, setExecutingToolCallIds] = useState<Set<string>>(
    new Set(),
  );

  const addExecutingToolCall = useCallback((toolCallId: string): void => {
    setExecutingToolCallIds((prev) => new Set(prev).add(toolCallId));
  }, []);

  const removeExecutingToolCall = useCallback((toolCallId: string): void => {
    setExecutingToolCallIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(toolCallId);
      return newSet;
    });
  }, []);

  const isExecuting = useCallback(
    (toolCallId?: string): boolean => {
      if (!toolCallId) {
        return executingToolCallIds.size > 0;
      }
      return executingToolCallIds.has(toolCallId);
    },
    [executingToolCallIds],
  );

  return {
    addExecutingToolCall,
    removeExecutingToolCall,
    isExecuting,
  };
}
