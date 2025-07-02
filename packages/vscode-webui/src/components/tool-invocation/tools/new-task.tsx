import { TaskThread } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/auth-client";
import { useIsAtBottom } from "@/lib/hooks/use-is-at-bottom";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { cn } from "@/lib/utils";
import type { ClientToolsType } from "@ragdoll/tools";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ExpandableToolContainer } from "../tool-container";
import type { ToolProps } from "../types";

export const newTaskTool: React.FC<ToolProps<ClientToolsType["newTask"]>> = ({
  tool,
  isExecuting,
}) => {
  const uid = tool.args?._meta?.uid;
  const description = tool.args?.description ?? "";

  if (!uid) {
    throw new Error("Missing task UID");
  }
  const taskRunners = useTaskRunners();
  const taskRunner = uid in taskRunners ? taskRunners[uid] : undefined;

  const shouldLoadCompletedTask = tool.state === "result" && !taskRunner;
  const { data: task, isFetching: isTaskLoading } = useQuery({
    queryKey: ["task", uid],
    queryFn: async () => {
      const resp = await apiClient.api.tasks[":uid"].$get({
        param: {
          uid,
        },
      });
      return resp.json();
    },
    enabled: shouldLoadCompletedTask,
  });

  const [expanded, setExpanded] = useState(false);
  const newTaskContainer = useRef<HTMLDivElement>(null);
  const { isAtBottom, scrollToBottom } = useIsAtBottom(newTaskContainer);
  const isAtBottomRef = useRef(isAtBottom);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  // Scroll to bottom when the message list height changes
  useEffect(() => {
    if (!expanded) {
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
  }, [scrollToBottom, expanded]);

  // Initial scroll to bottom once when component mounts (without smooth behavior)
  useLayoutEffect(() => {
    if (newTaskContainer.current) {
      scrollToBottom(false); // false = not smooth
    }
  }, [scrollToBottom]);

  const title = (
    <span className={cn("flex items-center gap-2")}>
      <p>
        <Badge
          variant="secondary"
          className={cn("px-1 py-0", {
            "animate-pulse": isExecuting,
          })}
        >
          Subtask
        </Badge>
        <span className="ml-2">{description}</span>
      </p>
    </span>
  );

  const taskSource = taskRunner
    ? { runner: taskRunner } // found background runner, task is running or completed in the current session
    : shouldLoadCompletedTask
      ? { task, isLoading: isTaskLoading } // load completed task, no background runner will be started
      : undefined; // no task source available, which means the task is not approved to start yet

  return (
    <ExpandableToolContainer
      title={title}
      onToggle={(expand: boolean) => {
        setExpanded(expand);
      }}
      expandableDetail={
        taskSource ? (
          <ScrollArea viewportClassname="max-h-[300px]" ref={newTaskContainer}>
            <TaskThread
              user={{ name: "Runner" }} // FIXME(zhiming): remove the display of user name
              taskSource={taskSource}
            />
          </ScrollArea>
        ) : undefined
      }
    />
  );
};
