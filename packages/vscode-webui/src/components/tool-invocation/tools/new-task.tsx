import { TaskThread, type TaskThreadSource } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToolCallLifeCycle } from "@/features/chat";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { cn } from "@/lib/utils";
import { toUIMessages } from "@ragdoll/common";
import type { ClientToolsType } from "@ragdoll/tools";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { StatusIcon } from "../status-icon";
import { ExpandIcon, ToolTitle } from "../tool-container";
import type { ToolProps } from "../types";

export const newTaskTool: React.FC<ToolProps<ClientToolsType["newTask"]>> = ({
  tool,
  isExecuting,
}) => {
  const uid = tool.args?._meta?.uid;
  const description = tool.args?.description ?? "";

  const lifecycle = useToolCallLifeCycle().getToolCallLifeCycle({
    toolName: tool.toolName,
    toolCallId: tool.toolCallId,
  });

  const lifecycleStreamingResult = lifecycle.streamingResult;
  if (
    lifecycleStreamingResult &&
    lifecycleStreamingResult.toolName !== "newTask"
  ) {
    throw new Error("Unexpected streaming result for newTask tool");
  }

  const taskRunnerState = lifecycleStreamingResult?.state;
  const inlinedTask = tool.args?._transient?.task;

  const shouldQueryTask =
    tool.state !== "partial-call" && !inlinedTask && !taskRunnerState && !!uid;
  const { data: loadedTask, isFetching: isTaskLoading } = useQuery({
    queryKey: ["task", uid],
    queryFn: async () => {
      if (!uid) {
        throw new Error("UID is required to query task");
      }
      const resp = await apiClient.api.tasks[":uid"].$get({
        param: {
          uid,
        },
      });
      return resp.json();
    },
    enabled: shouldQueryTask,
  });

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

  const taskSource: TaskThreadSource | undefined = taskRunnerState
    ? {
        // found background runner, task is running or completed in the current session
        type: "taskRunner",
        runner: taskRunnerState,
      }
    : inlinedTask
      ? {
          // inlined subtask, no need to query
          type: "task",
          messages: inlinedTask.messages ?? [],
          todos: inlinedTask.todos ?? [],
        }
      : shouldQueryTask
        ? {
            // query task
            type: "task",
            messages: toUIMessages(loadedTask?.conversation?.messages ?? []),
            todos: loadedTask?.todos ?? [],
            isLoading: isTaskLoading,
          }
        : undefined;

  return (
    <div>
      <ToolTitle>
        <span className={cn("flex items-center gap-2")}>
          <div>
            <StatusIcon tool={tool} isExecuting={isExecuting} />
            <Badge variant="secondary" className={cn("mr-1 ml-2 py-0")}>
              Subtask
            </Badge>
            <span className="ml-2">{description}</span>
          </div>
        </span>
        <ExpandIcon
          className="cursor-pointer"
          isExpanded={showMessageList}
          onClick={() => setShowMessageList(!showMessageList)}
        />
      </ToolTitle>
      {taskSource && (
        <ScrollArea viewportClassname="max-h-[300px]" ref={newTaskContainer}>
          <TaskThread source={taskSource} showMessageList={showMessageList} />
        </ScrollArea>
      )}
    </div>
  );
};
