import type { TaskRunnerState } from "@ragdoll/runner";
import { type ReactNode, useCallback, useMemo, useRef } from "react";
import { FixedStateToolCallLifeCycle } from "../fixed-state-tool-call-life-cycle";
import {
  ChatContext,
  type ChatState,
  type ToolCallLifeCycleKey,
} from "./types";

interface FixedStateChatContextProviderProps {
  taskRunnerState?: TaskRunnerState | undefined;
  children: ReactNode;
}

export function FixedStateChatContextProvider({
  taskRunnerState,
  children,
}: FixedStateChatContextProviderProps) {
  const autoApproveGuard = useRef(false);

  const lifecycleExecuting = useMemo(() => {
    if (
      taskRunnerState &&
      taskRunnerState.state === "running" &&
      taskRunnerState.progress.type === "executing-tool-call" &&
      taskRunnerState.progress.phase === "begin"
    ) {
      return new FixedStateToolCallLifeCycle(
        taskRunnerState.progress.toolName,
        taskRunnerState.progress.toolCallId,
        "execute",
      );
    }
  }, [taskRunnerState]);

  const getToolCallLifeCycle = useCallback(
    (key: ToolCallLifeCycleKey) => {
      if (
        lifecycleExecuting &&
        lifecycleExecuting.toolCallId === key.toolCallId
      ) {
        return lifecycleExecuting;
      }
      return new FixedStateToolCallLifeCycle(
        key.toolName,
        key.toolCallId,
        "dispose",
      );
    },
    [lifecycleExecuting],
  );

  const executingToolCalls = useMemo(() => {
    return lifecycleExecuting ? [lifecycleExecuting] : [];
  }, [lifecycleExecuting]);

  const completeToolCalls: FixedStateToolCallLifeCycle[] = [];

  const value: ChatState = {
    autoApproveGuard,
    getToolCallLifeCycle,
    executingToolCalls,
    completeToolCalls,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
