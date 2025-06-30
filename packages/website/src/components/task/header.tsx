import { GitBadge } from "@/components/git-badge";
import type { apiClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils/ui";
import type { InferResponseType } from "hono/client";
import { Calendar } from "lucide-react";
import type { ReactNode } from "react";

type Task = NonNullable<
  InferResponseType<(typeof apiClient.api.tasks)["$get"]>
>["data"][number];

interface HeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  actions?: ReactNode;
}

function TaskHeaderRoot({
  children,
  className,
  actions,
  ...props
}: HeaderProps) {
  return (
    <div className={cn("space-y-4 px-4", className)} {...props}>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-4 flex flex-col space-y-3 overflow-hidden md:col-span-3">
          {children}
        </div>
        {actions && (
          <div className="-ml-2.5 col-span-4 flex items-start gap-1 md:col-span-1 md:ml-0 md:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

interface TitleProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
}

function Title({ children, className, title, ...props }: TitleProps) {
  return (
    <div className={cn("flex flex-col", className)} {...props}>
      <span className="flex items-center gap-1">
        <h1 className="truncate whitespace-nowrap font-bold text-2xl">
          {title || "Task"}
        </h1>
        {children}
      </span>
    </div>
  );
}

interface SubtitleProps extends React.HTMLAttributes<HTMLDivElement> {
  updatedAt?: Date | string;
  git?: Task["git"];
}

function Subtitle({
  children,
  className,
  updatedAt,
  git,
  ...props
}: SubtitleProps) {
  return (
    <div
      className={cn(
        "flex min-h-4 flex-col gap-3 text-muted-foreground text-sm md:flex-row md:items-center",
        className,
      )}
      {...props}
    >
      {updatedAt && (
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          <span>
            {formatRelativeTime(new Date(updatedAt).toISOString(), "Updated")}
          </span>
        </div>
      )}
      {git && <GitBadge git={git} />}
      {children}
    </div>
  );
}

export const TaskHeader = Object.assign(TaskHeaderRoot, {
  Title,
  Subtitle,
});
