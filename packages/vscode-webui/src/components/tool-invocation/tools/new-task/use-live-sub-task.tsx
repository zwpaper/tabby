import type { TaskThreadSource } from "@/components/task-thread";
import {
  type ToolCallLifeCycle,
  useLiveChatKitGetters,
  useToolCallLifeCycle,
} from "@/features/chat";

import {
  ReadyForRetryError,
  useMixinReadyForRetryError,
  useRetry,
} from "@/features/retry";
import { useTodos } from "@/features/todo";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { vscodeHost } from "@/lib/vscode";
import { useChat } from "@ai-sdk/react";
import { catalog } from "@getpochi/livekit";
import { useLiveChatKit } from "@getpochi/livekit/react";
import type { Todo } from "@getpochi/tools";
import { useStore } from "@livestore/react";
import { getToolName, lastAssistantMessageIsCompleteWithToolCalls } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToolProps } from "../../types";

export function useLiveSubTask({
  tool,
  isExecuting,
}: Pick<ToolProps<"newTask">, "tool" | "isExecuting">): TaskThreadSource {
  // biome-ignore lint/style/noNonNullAssertion: uid must have been set.
  const uid = tool.input?._meta?.uid!;

  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle({
    toolName: getToolName(tool),
    toolCallId: tool.toolCallId,
  });

  const { store } = useStore();
  const task = store.useQuery(catalog.queries.makeTaskQuery(uid));
  const todosRef = useRef<Todo[] | undefined>(undefined);

  const getters = useLiveChatKitGetters({
    todos: todosRef,
  });

  // FIXME: handle auto retry for output without task.
  const chatKit = useLiveChatKit({
    taskId: uid,
    getters,
    isSubTask: true,
    sendAutomaticallyWhen: (x) => {
      const streamingResult = ensureNewTaskStreamingResult(
        lifecycle.streamingResult,
      );
      if (!streamingResult || streamingResult.abortSignal.aborted) {
        return false;
      }
      // AI SDK v5 will retry regardless of the status if sendAutomaticallyWhen is set.
      if (chatKit.chat.status === "error") {
        return false;
      }
      return lastAssistantMessageIsCompleteWithToolCalls(x);
    },
    onToolCall: async ({ toolCall }) => {
      const streamingResult = ensureNewTaskStreamingResult(
        lifecycle.streamingResult,
      );
      if (!streamingResult) {
        throw new Error("Unexpected parent toolCall state");
      }

      // completion tools
      if (
        toolCall.toolName === "attemptCompletion" ||
        toolCall.toolName === "askFollowupQuestion"
      ) {
        // no-op
        return;
      }

      const output = await vscodeHost.executeToolCall(
        toolCall.toolName,
        toolCall.input,
        {
          toolCallId: toolCall.toolCallId,
          abortSignal: streamingResult.serializedAbortSignal,
          nonInteractive: true,
        },
      );

      addToolResult({
        // @ts-expect-error
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        // @ts-expect-error
        output,
      });
    },
  });

  const {
    messages,
    status,
    error,
    stop,
    setMessages,
    sendMessage,
    addToolResult,
    regenerate,
  } = useChat({
    chat: chatKit.chat,
  });

  useEffect(() => {
    const streamingResult = ensureNewTaskStreamingResult(
      lifecycle.streamingResult,
    );
    if (!isExecuting || !streamingResult) {
      return;
    }

    const onAbort = () => {
      stop();
    };
    const { abortSignal } = streamingResult;
    abortSignal.addEventListener("abort", onAbort);
    return () => {
      abortSignal.removeEventListener("abort", onAbort);
    };
  }, [isExecuting, lifecycle.streamingResult, stop]);

  const [retryCount, setRetryCount] = useState(0);
  const retryImpl = useRetry({
    messages,
    setMessages,
    sendMessage,
    regenerate,
  });
  const retry = useCallback(
    (error?: Error) => {
      if (isExecuting && (status === "ready" || status === "error")) {
        retryImpl(error ?? new ReadyForRetryError());
      }
    },
    [retryImpl, status, isExecuting],
  );
  const retryWithCount = useCallback(
    (error?: Error) => {
      const streamingResult = ensureNewTaskStreamingResult(
        lifecycle.streamingResult,
      );
      if (!isExecuting || !streamingResult) {
        return;
      }
      setRetryCount((count) => count + 1);
      if (retryCount > SubtaskMaxRetry) {
        streamingResult.throws(
          "The sub-task failed to complete, max retry count reached.",
        );
        return;
      }
      retry(error);
    },
    [retry, retryCount, lifecycle.streamingResult, isExecuting],
  );

  const errorForRetry = useMixinReadyForRetryError(messages, error);
  const [
    pendingErrorForRetry,
    setPendingErrorForRetry,
    setDebouncedPendingErrorForRetry,
  ] = useDebounceState<Error | undefined>(undefined, 1000);
  useEffect(() => {
    if (
      isExecuting &&
      errorForRetry &&
      (status === "ready" || status === "error")
    ) {
      setPendingErrorForRetry(errorForRetry);
    }
  }, [errorForRetry, setPendingErrorForRetry, status, isExecuting]);
  useEffect(() => {
    const streamingResult = ensureNewTaskStreamingResult(
      lifecycle.streamingResult,
    );
    if (!isExecuting || !streamingResult) {
      return;
    }
    if (pendingErrorForRetry) {
      setDebouncedPendingErrorForRetry(undefined);
      retryWithCount(pendingErrorForRetry);
    }
  }, [
    retryWithCount,
    pendingErrorForRetry,
    setDebouncedPendingErrorForRetry,
    lifecycle.streamingResult,
    isExecuting,
  ]);

  const stepCount = useMemo(() => {
    return messages
      .flatMap((message) => message.parts)
      .filter((part) => part.type === "step-start").length;
  }, [messages]);
  const [currentStepCount, setCurrentStepCount] = useState(0);
  useEffect(() => {
    if (isExecuting && stepCount > currentStepCount) {
      setCurrentStepCount(stepCount);
      setRetryCount(0); // Reset retry count when a new step is started
    }
  }, [stepCount, currentStepCount, isExecuting]);

  useEffect(() => {
    const streamingResult = ensureNewTaskStreamingResult(
      lifecycle.streamingResult,
    );
    if (!isExecuting || !streamingResult) {
      return;
    }
    if (currentStepCount > SubtaskMaxStep) {
      streamingResult.throws(
        "The sub-task failed to complete, max step count reached.",
      );
    }
  }, [currentStepCount, lifecycle.streamingResult, isExecuting]);

  useInitAutoStart({
    start: retry,
    enabled:
      tool.state === "input-available" &&
      isExecuting &&
      currentStepCount <= SubtaskMaxStep &&
      // task is not completed or aborted
      !(
        (task?.status === "failed" && task.error?.kind === "AbortError") ||
        task?.status === "completed"
      ),
  });

  const { todos } = useTodos({
    initialTodos: task?.todos,
    messages,
    todosRef,
  });

  const isLoading = useMemo(() => {
    const streamingResult = ensureNewTaskStreamingResult(
      lifecycle.streamingResult,
    );
    return (
      streamingResult &&
      !streamingResult.abortSignal.aborted &&
      (status === "submitted" || status === "streaming")
    );
  }, [lifecycle.streamingResult, status]);

  return {
    messages,
    todos,
    isLoading,
  };
}

const SubtaskMaxStep = 24;
const SubtaskMaxRetry = 2;

const useInitAutoStart = ({
  start,
  enabled,
}: {
  start: () => void;
  enabled: boolean;
}) => {
  const initStarted = useRef(false);
  useEffect(() => {
    if (enabled && !initStarted.current) {
      initStarted.current = true;
      start();
    }
  }, [start, enabled]);
};

const ensureNewTaskStreamingResult = (
  streamingResult: ToolCallLifeCycle["streamingResult"],
) => {
  if (streamingResult?.toolName !== "newTask") {
    return undefined;
  }
  return streamingResult;
};
