import { TaskThread } from "@/components/task-thread";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/auth-client";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { cn } from "@/lib/utils";
import type { ClientToolsType } from "@ragdoll/tools";
import { useQuery } from "@tanstack/react-query";
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
      expandableDetail={
        taskSource ? (
          <div className="max-h-[300px] overflow-y-auto rounded-lg border">
            <TaskThread
              user={{ name: "Runner" }} // FIXME(zhiming): remove the display of user name
              taskSource={taskSource}
            />
          </div>
        ) : undefined
      }
    />
  );
};
