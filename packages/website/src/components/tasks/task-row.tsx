import type { apiClient } from "@/lib/auth-client";
import { formatRelativeTime } from "@/lib/utils/ui";
import { IconBrandChrome, IconBrandSlack } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Calendar } from "lucide-react";
import { GitBadge } from "../git-badge";
import { MinionBadge } from "../minions/minion-badge";
import { Badge } from "../ui/badge";
import { TaskRowActions } from "./task-row-actions";

type Task = InferResponseType<
  (typeof apiClient.api.tasks)["$get"]
>["data"][number];

interface TaskRowProps {
  task: Task;
}

export function TaskRow({ task }: TaskRowProps) {
  const showBadges = task?.minionId || task.event?.type;

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
            {showBadges && (
              <div className="flex flex-wrap items-center gap-3">
                {task.event?.type && <EventBadge event={task.event.type} />}
                {task?.minionId && <MinionBadge minionId={task.minionId} />}
              </div>
            )}
            <div className="flex min-h-4 flex-col gap-3 text-muted-foreground text-xs md:mt-3 md:flex-row md:items-center">
              {task?.updatedAt && (
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span>{formatRelativeTime(task.updatedAt, "Updated")}</span>
                </div>
              )}
              {task?.git && <GitBadge git={task.git} interactive={false} />}
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

function EventBadge({ event }: { event: string }) {
  const type = event.split(":")[0];
  let IconType = IconBrandChrome;
  switch (type) {
    case "slack":
      IconType = IconBrandSlack;
      break;
    default:
      break;
  }
  return (
    <Badge
      variant="default"
      className="cursor-default bg-primary/20 text-secondary-foreground"
      onClick={(e) => e.preventDefault()}
    >
      <IconType className="size-4" />
      {type}
    </Badge>
  );
}
