import type { Task } from "../tasks/types";
import { getStatusIcon } from "./utils";

interface TaskOverviewGridProps {
  tasks: Task[];
}

export function TaskOverviewGrid({ tasks }: TaskOverviewGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {tasks.map((task) => (
        <div
          key={task.uid}
          className="flex items-center gap-2 rounded-lg border bg-background p-3 text-sm transition-colors hover:bg-accent/50"
          title={`Task ${task.uid}: ${task.title}`}
        >
          {getStatusIcon(task.status)}
          <span className="font-mono text-sm">{task.uid}</span>
        </div>
      ))}
    </div>
  );
}
