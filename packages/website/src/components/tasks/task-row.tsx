import type { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/ui";
import {
  IconBrandChrome,
  IconBrandSlack,
  IconBrandVscode,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { Calendar } from "lucide-react";
import { GitBadge } from "../git-badge";
import { Badge } from "../ui/badge";

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
      className="group block cursor-pointer rounded-sm border border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-200 hover:border-border hover:bg-card hover:shadow-sm"
    >
      <div className="px-4 py-4 sm:px-5">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="flex-1 space-y-2.5 overflow-hidden sm:space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-2">
              <h3 className="line-clamp-2 flex-1 font-semibold text-foreground text-sm leading-relaxed transition-colors sm:text-base">
                {addLineBreak(task.title)}
              </h3>
              {task.event?.type && (
                <EventBadge
                  className="md:mt-1"
                  event={task.event.type}
                  minionId={task.minionId || undefined}
                />
              )}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
              {task?.updatedAt && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm">
                  <Calendar className="h-3 w-3 opacity-70 sm:h-3.5 sm:w-3.5" />
                  <span className="font-medium">
                    {formatRelativeTime(task.updatedAt, "Updated")}
                  </span>
                </div>
              )}
              {task?.git && (
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs sm:text-sm">
                  <GitBadge git={task.git} interactive={false} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

function EventBadge({
  className,
  event,
  minionId,
}: { event: string; minionId?: string; className?: string }) {
  const type = event.split(":")[0];
  let IconType = IconBrandChrome;
  let badgeColor = "bg-blue-50 text-blue-700 border-blue-200";

  switch (type) {
    case "slack":
      IconType = IconBrandSlack;
      badgeColor = "bg-purple-50 text-purple-700 border-purple-200";
      break;
    case "code":
      IconType = IconBrandVscode;
      badgeColor = "bg-blue-50 text-blue-700 border-blue-200";
      break;
    default:
      badgeColor = "bg-gray-50 text-gray-700 border-gray-200";
      break;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!minionId) return;

    const minionUrl = `/api/minions/${minionId}/redirect`;
    window.open(minionUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "border transition-all duration-200",
        badgeColor,
        {
          "cursor-default": !minionId,
          "cursor-pointer hover:shadow-sm": !!minionId,
        },
        className,
      )}
      onClick={handleClick}
    >
      <IconType className="size-3" />
      <span className="font-medium">{type}</span>
    </Badge>
  );
}

const addLineBreak = (text: string) => {
  return text.replace(
    /[\/\.\+\?\=\%\&\#\:\;\,\_\~]/g,
    (match) => `${match}\u200B`,
  );
};
