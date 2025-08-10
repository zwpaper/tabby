import { TaskThread, type TaskThreadSource } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLiveChatKitGetters, useToolCallLifeCycle } from "@/features/chat";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { cn } from "@/lib/utils";

import { useTodos } from "@/features/todo";
import { vscodeHost } from "@/lib/vscode";
import {
  getToolName,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "@ai-v5-sdk/ai";
import { useChat } from "@ai-v5-sdk/react";
import type { Todo } from "@getpochi/tools";
import { useStore } from "@livestore/react";
import { type Task, catalog } from "@ragdoll/livekit";
import { useLiveChatKit } from "@ragdoll/livekit/react";
import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      if (lifecycle.streamingResult?.toolName !== "newTask") {
        throw new Error(`Unexpected ${toolCall.toolName} (expected: newTask)`);
      }

      // FIXME: avoid ui like diff view, execute Command when calling from sub task.
      // FIXME: for executeCommand, properly handle executeCommand
      const output = await vscodeHost.executeToolCall(
        toolCall.toolName,
        toolCall.input,
        {
          toolCallId: toolCall.toolCallId,
          abortSignal: lifecycle.streamingResult.serializedAbortSignal,
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

  const { messages, stop, sendMessage, addToolResult } = useChat({
    chat: chatKit.chat,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies(isExecuting): watch for executing changed.
  useEffect(() => {
    if (lifecycle.streamingResult?.toolName !== "newTask") {
      return;
    }

    const onAbort = () => stop();
    const { abortSignal } = lifecycle.streamingResult;
    abortSignal.addEventListener("abort", onAbort);
    return () => {
      abortSignal.removeEventListener("abort", onAbort);
    };
  }, [isExecuting, lifecycle, stop]);

  usePendingModelAutoStart({
    task,
    start: () => sendMessage(undefined),
    enabled:
      tool.state === "input-available" && isExecuting && messages.length === 1,
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

const usePendingModelAutoStart = ({
  task,
  start,
  enabled,
}: {
  task?: Task;
  start: () => void;
  enabled: boolean;
}) => {
  const init = task?.status === "pending-model";

  const initStarted = useRef(false);
  useEffect(() => {
    if (enabled && init && !initStarted.current) {
      initStarted.current = true;
      start();
    }
  }, [init, start, enabled]);
};
