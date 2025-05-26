import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { useState } from "react";
import { TaskList } from "./task-list";
import { TaskOverviewGrid } from "./task-overview-grid";
import type { BatchStatus } from "./types";

interface HistoryBatchListProps {
  batches: BatchStatus[];
  excludeBatchId?: string;
}

export function HistoryBatchList({
  batches,
  excludeBatchId,
}: HistoryBatchListProps) {
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(
    new Set(),
  );

  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatches((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
  };

  const filteredBatches = batches.filter(
    (batch) => batch.batchId !== excludeBatchId,
  );

  if (filteredBatches.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <History className="mx-auto mb-4 h-16 w-16 opacity-30" />
        <h3 className="mb-1 font-medium text-lg">
          No evaluation history found
        </h3>
        <p className="text-sm">
          Previous test batches will appear here after you run evaluations
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {filteredBatches.map((batch) => (
        <div
          key={batch.batchId}
          className="space-y-4 rounded-xl border bg-card p-6 transition-all duration-200 hover:shadow-md"
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <h4 className="font-mono font-semibold text-base">
                  Batch ID: {batch.batchId}
                </h4>
                <Badge variant="outline" className="px-2 py-1 text-sm">
                  {batch.totalTasks} tasks
                </Badge>
                <Badge
                  variant={
                    batch.status === "completed"
                      ? "default"
                      : batch.status === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                  className="px-3 py-1 text-sm"
                >
                  {batch.status}
                </Badge>
              </div>
              <div className="space-y-1 text-muted-foreground text-sm">
                <p>Created: {new Date(batch.createdAt).toLocaleString()}</p>
                {batch.githubTemplateUrl && (
                  <p className="truncate">
                    Template:{" "}
                    <span className="font-mono">{batch.githubTemplateUrl}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between font-medium text-sm">
              <span className="text-foreground">Progress</span>
              <span className="text-primary">
                {batch.completedTasks}/{batch.totalTasks} completed
                {batch.failedTasks > 0 && (
                  <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                    ({batch.failedTasks} failed)
                  </span>
                )}
              </span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-secondary">
              <div
                className="h-2.5 rounded-full bg-primary transition-all duration-300"
                style={{
                  width: `${(batch.completedTasks / batch.totalTasks) * 100}%`,
                }}
              />
            </div>
          </div>

          <div className="space-y-3">
            <h5 className="font-semibold text-foreground text-sm">
              Task Overview
            </h5>
            <TaskOverviewGrid tasks={batch.tasks} />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => toggleBatchExpansion(batch.batchId)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg p-2 font-medium text-muted-foreground text-sm transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              {expandedBatches.has(batch.batchId) ? (
                <ChevronDown className="h-4 w-4 transition-transform" />
              ) : (
                <ChevronRight className="h-4 w-4 transition-transform" />
              )}
              View task details
            </button>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expandedBatches.has(batch.batchId)
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0"
              }`}
            >
              <TaskList tasks={batch.tasks} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
