import type { apiClient } from "@/lib/auth-client";
import { formatRelativeTime } from "@/lib/utils/ui";
import { Link } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Calendar } from "lucide-react";
import { GitBadge } from "../git-badge";
import { TaskRowActions } from "./task-row-actions";

type Task = InferResponseType<
  (typeof apiClient.api.tasks)["$get"]
>["data"][number];

interface TaskRowProps {
  task: Task;
}

export function TaskRow({ task }: TaskRowProps) {
  return (
    <Link
      to={"/tasks/$uid"}
      params={{ uid: task.uid }}
      className="group block cursor-pointer rounded-lg border transition-colors duration-200 hover:bg-muted/50 hover:text-muted-foreground"
    >
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2 overflow-hidden">
            <h3 className="line-clamp-2 flex-1 font-medium text-foreground">
              {task.title}
            </h3>
            <div className="flex min-h-4 flex-col gap-3 text-muted-foreground text-xs md:mt-3 md:flex-row md:items-center">
              {task?.updatedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatRelativeTime(task.updatedAt, "Updated")}</span>
                </div>
              )}
              {task?.git && <GitBadge git={task.git} />}
            </div>
          </div>
          <div
            className="flex items-center gap-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <TaskRowActions task={task} />
          </div>
        </div>
      </div>
    </Link>
  );
}
