import { useCallback, useRef, useState } from "react";

export type ToolCallState = "executing" | "rejected" | "completed";

const AllowedTransition: Map<ToolCallState | undefined, ToolCallState[]> =
  new Map([
    [undefined, ["executing", "rejected"]],
    ["executing", ["completed"]],
    ["completed", []],
  ]);

// Hook to manage tool call states
export function useToolCallStates() {
  const [_, setToolCallStates] = useState<Map<string, ToolCallState>>(
    new Map(),
  );

  // Ref to track latest status for immediate access
  const toolCallStatesRef = useRef<Map<string, ToolCallState>>(new Map());

  const setToolCallState = useCallback(
    (toolCallId: string, state: ToolCallState): void => {
      const prevState = toolCallStatesRef.current.get(toolCallId);
      const allowedTransitions = AllowedTransition.get(prevState);
      if (!allowedTransitions || !allowedTransitions.includes(state)) {
        const error = new Error(
          `Invalid state transition from ${prevState} to ${state}`,
        );
        console.error(error.message);
        throw error;
      }

      const newMap = new Map(toolCallStatesRef.current);
      newMap.set(toolCallId, state);
      toolCallStatesRef.current = newMap;
      setToolCallStates(newMap);
    },
    [],
  );

  const getToolCallState = useCallback((toolCallId: string) => {
    return toolCallStatesRef.current.get(toolCallId);
  }, []);

  const hasToolCallState = useCallback((state: ToolCallState) => {
    return toolCallStatesRef.current.values().some((s) => s === state);
  }, []);

  return {
    getToolCallState,
    setToolCallState,
    hasToolCallState,
  };
}
