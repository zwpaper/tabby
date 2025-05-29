import defaultPrompts from "@/components/evaluation/default-test-prompts.json";
import { HistoryBatchList } from "@/components/evaluation/history-batch-list";
import { TaskList } from "@/components/evaluation/task-list";
import type { Task } from "@/components/tasks/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/auth-client";
import { useEvaluationRunner } from "@/lib/use-evaluation-runner";
import type { UserEventDataHelper } from "@ragdoll/common";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle,
  History,
  Loader2,
  PlayIcon,
  StopCircle,
  XCircle,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/admin/prompt-evaluation")(
  {
    component: RouteComponent,
  },
);

function calculateBatchStatus(
  tasks: Task[],
): "running" | "completed" | "failed" {
  const completedTasks = tasks.filter(
    (task) => task.status === "completed" || task.status === "failed",
  ).length;
  const failedTasks = tasks.filter((task) => task.status === "failed").length;

  if (completedTasks === tasks.length) {
    return failedTasks === tasks.length ? "failed" : "completed";
  }
  return "running";
}

function RouteComponent() {
  const [githubTemplateUrl, setGithubTemplateUrl] = useState(
    "https://github.com/wsxiaoys/reimagined-octo-funicular",
  );
  const [promptsJson, setPromptsJson] = useState(
    JSON.stringify(defaultPrompts, null, 2),
  );
  const [maxConcurrentRunning, setMaxConcurrentRunning] = useState(1);

  // Use the combined evaluation runner hook
  const {
    isRunning,
    currentBatchId,
    currentProgress,
    validation,
    startEvaluation,
    resetEvaluation,
  } = useEvaluationRunner(promptsJson);

  const { data: batchStatus } = useQuery({
    queryKey: ["evaluationBatch", currentBatchId],
    queryFn: async () => {
      if (!currentBatchId) return null;

      const response = await apiClient.api.tasks.$get({
        query: {
          eventFilter: JSON.stringify({
            type: "batch:evaluation",
            data: { batchId: currentBatchId } satisfies Partial<
              UserEventDataHelper<"batch:evaluation">
            >,
          }),
        },
      });

      const data = await response.json();
      const tasks = data.data;
      const status = calculateBatchStatus(tasks);

      return {
        batchId: currentBatchId,
        totalTasks: tasks.length,
        completedTasks: tasks.filter(
          (task) => task.status === "completed" || task.status === "failed",
        ).length,
        failedTasks: tasks.filter((task) => task.status === "failed").length,
        status,
        tasks,
      };
    },
    enabled: !!currentBatchId,
    refetchInterval: currentBatchId ? 2000 : false,
  });

  // Query for evaluation history
  const { data: evaluationHistory } = useQuery({
    queryKey: ["evaluationHistory"],
    queryFn: async () => {
      const response = await apiClient.api.tasks.$get({
        query: {
          eventFilter: JSON.stringify({
            type: "batch:evaluation",
            data: {},
          }),
        },
      });
      const data = await response.json();

      // Group tasks by batchId
      const batchGroups = new Map<string, Task[]>();

      for (const task of data.data) {
        if (task.event?.type !== "batch:evaluation") {
          continue;
        }
        const batchId = task.event?.data?.batchId;
        if (task.event?.type === "batch:evaluation" && batchId) {
          if (!batchGroups.has(batchId)) {
            batchGroups.set(batchId, []);
          }
          batchGroups.get(batchId)?.push(task);
        }
      }

      // Convert to array and sort by creation time
      return Array.from(batchGroups.entries())
        .map(([batchId, tasks]) => {
          const status = calculateBatchStatus(tasks);
          const completedTasks = tasks.filter(
            (task) => task.status === "completed" || task.status === "failed",
          ).length;
          const failedTasks = tasks.filter(
            (task) => task.status === "failed",
          ).length;

          return {
            batchId,
            totalTasks: tasks.length,
            completedTasks,
            failedTasks,
            status,
            tasks: tasks.sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime(),
            ),
            createdAt: tasks[0]?.createdAt || new Date().toISOString(),
            githubTemplateUrl: tasks[0]?.event?.data?.githubTemplateUrl,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
    },
    refetchInterval: 10000,
  });

  const handleRunEvaluation = async () => {
    await startEvaluation({
      githubTemplateUrl,
      promptsJson,
      maxConcurrentRunning,
    });
  };

  const handleCancelEvaluation = () => {
    resetEvaluation();
  };

  return (
    <div className="flex h-full flex-col space-y-8 overflow-auto bg-background p-8">
      <div className="space-y-2">
        <h1 className="font-bold text-3xl tracking-tight">Prompt Evaluation</h1>
        <p className="text-lg text-muted-foreground">
          Test and evaluate system prompts with custom templates and scenarios
        </p>
      </div>

      {/* Current Evaluation Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl">Test Configuration</CardTitle>
          <CardDescription className="text-base">
            Configure the template and prompts for the test run
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <Label htmlFor="templateUrl" className="font-medium text-sm">
                Template URL
              </Label>
              <Input
                id="templateUrl"
                value={githubTemplateUrl}
                onChange={(e) => setGithubTemplateUrl(e.target.value)}
                placeholder="GitHub template URL"
                disabled={isRunning}
                className="transition-colors focus:border-primary"
              />
            </div>

            <div className="space-y-3">
              <Label htmlFor="maxConcurrent" className="font-medium text-sm">
                Max Concurrent Running
              </Label>
              <Input
                id="maxConcurrent"
                type="number"
                min="1"
                max="10"
                value={maxConcurrentRunning}
                onChange={(e) =>
                  setMaxConcurrentRunning(Number.parseInt(e.target.value) || 1)
                }
                placeholder="Maximum concurrent evaluations"
                disabled={isRunning}
                className="transition-colors focus:border-primary"
              />
              <p className="text-muted-foreground text-sm">
                Maximum number of prompts to process concurrently (1-10)
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="promptsJson" className="font-medium text-sm">
              Prompts (Array of Strings)
            </Label>
            <Textarea
              id="promptsJson"
              value={promptsJson}
              onChange={(e) => setPromptsJson(e.target.value)}
              placeholder='["prompt 1", "prompt 2", "prompt 3"]'
              className="min-h-[200px] font-mono text-sm transition-colors focus:border-primary"
              rows={10}
              disabled={isRunning}
            />
            {!validation.isValid && validation.error && (
              <p className="flex items-center gap-2 text-destructive text-sm">
                <XCircle className="h-4 w-4" />
                {validation.error}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleRunEvaluation}
              disabled={isRunning || !validation.isValid}
              className="h-12 flex-1 font-medium text-base transition-all duration-200 hover:shadow-md"
              size="lg"
            >
              {isRunning ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Running Test...
                </>
              ) : (
                <>
                  <PlayIcon className="mr-2 h-5 w-5" />
                  Start Test
                </>
              )}
            </Button>

            {isRunning && (
              <Button
                onClick={handleCancelEvaluation}
                variant="outline"
                className="h-12 px-6 font-medium text-base transition-all duration-200"
                size="lg"
              >
                <StopCircle className="mr-2 h-5 w-5" />
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Current Batch Status Display - Combined Status */}
      {currentBatchId && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="flex items-center gap-3 text-xl">
              Current Test Status
              <Badge
                variant={
                  batchStatus?.status === "completed"
                    ? "default"
                    : batchStatus?.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
                className="px-3 py-1 text-sm"
              >
                {batchStatus?.status || (isRunning ? "sending" : "sent")}
              </Badge>
            </CardTitle>
            <CardDescription className="text-base">
              Batch ID:{" "}
              <code className="rounded bg-muted px-2 py-1 text-sm">
                {currentBatchId}
              </code>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Sending Progress */}
            <div className="space-y-3">
              <div className="flex justify-between font-medium text-sm">
                <span className="text-foreground">Sending Progress</span>
                <span className="text-primary">
                  {currentProgress.sent}/{currentProgress.total} prompts sent
                </span>
              </div>
              <div className="h-3 w-full rounded-full bg-secondary">
                <div
                  className="h-3 rounded-full bg-primary transition-all duration-500 ease-out"
                  style={{
                    width: `${currentProgress.total > 0 ? (currentProgress.sent / currentProgress.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Task Execution Progress */}
            {batchStatus && (
              <div className="space-y-3">
                <div className="flex justify-between font-medium text-sm">
                  <span className="text-foreground">
                    Task Execution Progress
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {batchStatus.completedTasks}/{batchStatus.totalTasks} tasks
                    completed
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-secondary">
                  <div
                    className="h-3 rounded-full bg-green-500 transition-all duration-500 ease-out"
                    style={{
                      width: `${(batchStatus.completedTasks / batchStatus.totalTasks) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Status Messages */}
            {!isRunning &&
              currentProgress.completed === currentProgress.total &&
              currentProgress.completed > 0 && (
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <p className="font-medium text-green-800 text-sm dark:text-green-200">
                      All {currentProgress.total} prompts completed successfully
                    </p>
                  </div>
                </div>
              )}

            {isRunning && currentProgress.sent > currentProgress.completed && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400" />
                  <p className="font-medium text-blue-800 text-sm dark:text-blue-200">
                    {currentProgress.sent - currentProgress.completed} tasks
                    running...
                  </p>
                </div>
              </div>
            )}

            {/* Tasks List */}
            {batchStatus && batchStatus.tasks.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-semibold text-base text-foreground">
                  Task Details
                </h4>
                <TaskList tasks={batchStatus.tasks} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Evaluation History Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="flex items-center gap-3 text-xl">
            <History className="h-6 w-6" />
            Test History
          </CardTitle>
          <CardDescription className="text-base">
            Previous test batch IDs and their task records
          </CardDescription>
        </CardHeader>
        <CardContent>
          {evaluationHistory ? (
            <HistoryBatchList
              batches={evaluationHistory}
              excludeBatchId={currentBatchId || undefined}
            />
          ) : (
            <div className="py-12 text-center text-muted-foreground">
              <History className="mx-auto mb-4 h-16 w-16 opacity-30" />
              <h3 className="mb-1 font-medium text-lg">
                Loading test history...
              </h3>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
