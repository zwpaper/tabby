import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
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
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const vscodeLink = `vscode://TabbyML.pochi/?task=${task.id}`;
                      window.open(vscodeLink);
                    }}
                    className="h-6 px-2 text-xs"
                    title="Open in VSCode"
                  >
                    <ExternalLink className="mr-1 h-3 w-3" />
                    VSCode
                  </Button>
                  <Badge
                    variant="outline"
                    className="shrink-0 font-mono text-xs"
                  >
                    #{task.id}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
