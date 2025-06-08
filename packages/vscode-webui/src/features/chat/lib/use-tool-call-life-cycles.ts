import { useCallback, useMemo, useRef, useState } from "react";
import { ToolCallLifeCycle } from "./tool-call-life-cycle";

// Hook to manage tool call states
export function useToolCallLifeCycles() {
  const [toolCallLifeCycles, setToolCallLifeCycles] = useState<
    Map<string, ToolCallLifeCycle>
  >(new Map());

  // Expose toolCallLifeCycles for debugging
  // @ts-ignore
  window.toolCallLifeCycles = [...toolCallLifeCycles.values()];

  const completeToolCalls = useMemo(() => {
    const complete = [];
    for (const lifecycle of toolCallLifeCycles.values()) {
      if (lifecycle.status === "complete") {
        complete.push(lifecycle);
      }
    }
    return complete;
  }, [toolCallLifeCycles]);

  const executingToolCalls = useMemo(() => {
    const executing = [];
    for (const lifecycle of toolCallLifeCycles.values()) {
      if (lifecycle.status.startsWith("execute")) {
        executing.push(lifecycle);
      }
    }
    return executing;
  }, [toolCallLifeCycles]);

  const reloadToolCallLifeCycles = useCallback(() => {
    setToolCallLifeCycles(new Map(toolCallLifeCyclesRef.current));
  }, []);

  // Ref to track latest status for immediate access
  const toolCallLifeCyclesRef = useRef<Map<string, ToolCallLifeCycle>>(
    new Map(),
  );

  const getToolCallLifeCycle = useCallback(
    (toolName: string, toolCallId: string) => {
      if (!toolCallLifeCyclesRef.current.has(toolCallId)) {
        const lifecycle = new ToolCallLifeCycle(toolName, toolCallId);
        toolCallLifeCyclesRef.current.set(toolCallId, lifecycle);
        const unsubscribe = lifecycle.onAny((name) => {
          reloadToolCallLifeCycles();

          // Clean up listeners when the tool call is completed
          if (name === "dispose") {
            unsubscribe();
          }
        });
      }

      return toolCallLifeCyclesRef.current.get(
        toolCallId,
        // Guaranteed to exist because we just set it above
      ) as ToolCallLifeCycle;
    },
    [reloadToolCallLifeCycles],
  );

  return {
    getToolCallLifeCycle,
    executingToolCalls,
    completeToolCalls,
  };
}

export type { ToolCallLifeCycle };
