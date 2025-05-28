import { Badge } from "@/components/ui/badge";
import type { Task } from "../tasks/types";
import { getStatusIcon } from "./utils";

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  return (
    <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="rounded-lg border bg-card p-4 shadow-sm transition-all duration-200 hover:bg-accent/50"
        >
          <div className="mb-3 flex items-start gap-3">
            <div className="mt-0.5">{getStatusIcon(task.status)}</div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center justify-between">
                <span className="truncate font-medium text-sm">
                  {task.title}
                </span>
                <Badge
                  variant="outline"
                  className="ml-2 shrink-0 font-mono text-xs"
                >
                  #{task.id}
                </Badge>
              </div>
              {task.event && (
                <div className="text-muted-foreground text-xs">
                  {task.event.type === "batch:evaluation" &&
                    task.event.data?.projectDirectory && (
                      <>
                        <span className="font-medium">Project:</span>
                        <code className="ml-2 rounded bg-muted px-2 py-1 text-xs">
                          {task.event.data.projectDirectory}
                        </code>
                      </>
                    )}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
