import { TaskThread, type TaskThreadSource } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveChatKitGetters, useToolCallLifeCycle } from "@/features/chat";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { cn } from "@/lib/utils";

import {
  ReadyForRetryError,
  useMixinReadyForRetryError,
  useRetry,
} from "@/features/retry";
import { useTodos } from "@/features/todo";
import { useDebounceState } from "@/lib/hooks/use-debounce-state";
import { vscodeHost } from "@/lib/vscode";
import {
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "@ai-v5-sdk/ai";
import { useChat } from "@ai-v5-sdk/react";
import type { Todo } from "@getpochi/tools";
import { useStore } from "@livestore/react";
import { catalog } from "@ragdoll/livekit";
import { useLiveChatKit } from "@ragdoll/livekit/react";
import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StatusIcon } from "../status-icon";
import { ExpandIcon, ToolTitle } from "../tool-container";
import type { ToolProps } from "../types";

export const newTaskTool: React.FC<ToolProps<"newTask">> = ({
  tool,
  isExecuting,
}) => {
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
    sendAutomaticallyWhen: (x) => {
      // AI SDK v5 will retry regardless of the status if sendAutomaticallyWhen is set.
      if (chatKit.chat.status === "error") {
        return false;
      }
      return lastAssistantMessageIsCompleteWithToolCalls(x);
    },
    onToolCall: async ({ toolCall }) => {
      if (lifecycle.streamingResult?.toolName !== "newTask") {
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
          abortSignal: lifecycle.streamingResult.serializedAbortSignal,
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
    if (!isExecuting || lifecycle.streamingResult?.toolName !== "newTask") {
      return;
    }

    const onAbort = () => stop();
    const { abortSignal } = lifecycle.streamingResult;
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
      if (!isExecuting || lifecycle.streamingResult?.toolName !== "newTask") {
        return;
      }
      setRetryCount((count) => count + 1);
      if (retryCount > SubtaskMaxRetry) {
        lifecycle.streamingResult.throws(
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
    if (!isExecuting || lifecycle.streamingResult?.toolName !== "newTask") {
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
    if (!isExecuting || lifecycle.streamingResult?.toolName !== "newTask") {
      return;
    }
    if (currentStepCount > SubtaskMaxStep) {
      lifecycle.streamingResult.throws(
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

  const description = tool.input?.description ?? "";

  const taskSource: TaskThreadSource = {
    type: "task",
    messages,
    todos,
  };

  const [showMessageList, setShowMessageList] = useState(false);
  const newTaskContainer = useRef<HTMLDivElement>(null);
  const { isAtBottom, scrollToBottom } = useIsAtBottom(newTaskContainer);
  const isAtBottomRef = useRef(isAtBottom);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    if (!showMessageList) {
      return;
    }
    const container = newTaskContainer.current;
    if (!container?.children[0]) {
      return;
    }
    const resizeObserver = new ResizeObserver(() => {
      if (isAtBottomRef.current) {
        requestAnimationFrame(() => scrollToBottom());
      }
    });
    resizeObserver.observe(container);
    resizeObserver.observe(container.children[0]);
    return () => {
      resizeObserver.disconnect();
    }; // clean up
  }, [scrollToBottom, showMessageList]);

  // Initial scroll to bottom once when component mounts (without smooth behavior)
  useLayoutEffect(() => {
    if (newTaskContainer.current) {
      scrollToBottom(false); // false = not smooth
    }
  }, [scrollToBottom]);

  return (
    <div>
      <ToolTitle>
        <span className={cn("flex items-center gap-2")}>
          <div>
            <StatusIcon tool={tool} isExecuting={isExecuting} />
            <Badge variant="secondary" className={cn("mr-1 ml-2 py-0")}>
              <Link to="/" search={{ uid, ts: Date.now() }} replace={true}>
                Subtask
              </Link>
            </Badge>
            <span className="ml-2">{description}</span>
          </div>
        </span>
        {messages.length > 1 && (
          <ExpandIcon
            className="cursor-pointer"
            isExpanded={showMessageList}
            onClick={() => setShowMessageList(!showMessageList)}
          />
        )}
      </ToolTitle>
      {taskSource && (
        <ScrollArea viewportClassname="max-h-[300px]" ref={newTaskContainer}>
          <TaskThread source={taskSource} showMessageList={showMessageList} />
        </ScrollArea>
      )}
    </div>
  );
};

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
