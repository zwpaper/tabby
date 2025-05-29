import { apiClient } from "@/lib/auth-client";
import type { UserEventDataHelper } from "@ragdoll/common";
import { useMemo, useRef, useState } from "react";

export interface EvaluationConfig {
  githubTemplateUrl: string;
  promptsJson: string;
  maxConcurrentRunning: number;
}

export interface EvaluationProgress {
  completed: number;
  total: number;
  sent: number;
}

export interface PromptsValidation {
  isValid: boolean;
  prompts: string[];
  error: string | null;
}

export interface UseEvaluationRunnerReturn {
  isRunning: boolean;
  currentBatchId: string | null;
  currentProgress: EvaluationProgress;
  validation: PromptsValidation;
  startEvaluation: (config: EvaluationConfig) => Promise<void>;
  resetEvaluation: () => void;
}

export function useEvaluationRunner(
  promptsJson: string,
): UseEvaluationRunnerReturn {
  const [isRunning, setIsRunning] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [currentProgress, setCurrentProgress] = useState<EvaluationProgress>({
    completed: 0,
    total: 0,
    sent: 0,
  });

  // Ref to track cancellation
  const cancelledRef = useRef(false);
  const runningPromptsRef = useRef(new Set<number>());

  // Validate prompts JSON
  const validation = useMemo((): PromptsValidation => {
    try {
      const parsed = JSON.parse(promptsJson);
      const isValid =
        Array.isArray(parsed) &&
        parsed.every((item) => typeof item === "string");

      return {
        isValid,
        prompts: isValid ? (parsed as string[]) : [],
        error: isValid ? null : "Must be a valid JSON array of strings",
      };
    } catch (error) {
      return {
        isValid: false,
        prompts: [],
        error: "Invalid JSON format",
      };
    }
  }, [promptsJson]);

  const waitForTaskCompletion = async (
    batchId: string,
    promptIndex: number,
  ): Promise<void> => {
    while (!cancelledRef.current) {
      const response = await apiClient.api.tasks.$get({
        query: {
          eventFilter: JSON.stringify({
            type: "batch:evaluation",
            data: { batchId } satisfies Partial<
              UserEventDataHelper<"batch:evaluation">
            >,
          }),
        },
      });
      const data = await response.json();

      const promptTasks = data.data
        .filter((task) => task.event?.type === "batch:evaluation")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        );

      const taskForThisPrompt = promptTasks[promptIndex];

      if (
        taskForThisPrompt &&
        (taskForThisPrompt.status === "completed" ||
          taskForThisPrompt.status === "failed")
      ) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  };

  const startEvaluation = async (config: EvaluationConfig): Promise<void> => {
    if (!validation.isValid) {
      throw new Error(validation.error || "Invalid prompts");
    }

    setIsRunning(true);
    cancelledRef.current = false;
    runningPromptsRef.current.clear();

    const { githubTemplateUrl, maxConcurrentRunning } = config;
    const prompts = validation.prompts;

    const batchId = `eval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setCurrentBatchId(batchId);
    setCurrentProgress({ completed: 0, total: prompts.length, sent: 0 });

    let completedCount = 0;
    let sentCount = 0;

    const processSinglePrompt = async (promptIndex: number): Promise<void> => {
      const prompt = prompts[promptIndex];
      runningPromptsRef.current.add(promptIndex);

      try {
        if (cancelledRef.current) return;

        const evaluationParams = {
          batchId,
          githubTemplateUrl,
          prompt,
          promptIndex,
          totalPrompts: prompts.length,
        };
        const taskResponse = await apiClient.api.tasks.$post({
          json: {
            prompt,
            event: {
              type: "batch:evaluation",
              data: evaluationParams,
            },
          },
        });

        if (!taskResponse.ok) {
          resetEvaluation();
          console.error("Failed to start evaluation");
          return;
        }

        const taskId = (await taskResponse.json()).taskId;

        const vscodeUri = `vscode://TabbyML.pochi/?task=${taskId}`;
        window.open(vscodeUri, "_blank");

        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (cancelledRef.current) return;

        sentCount++;
        setCurrentProgress({
          completed: completedCount,
          total: prompts.length,
          sent: sentCount,
        });

        await waitForTaskCompletion(batchId, promptIndex);

        completedCount++;
        setCurrentProgress({
          completed: completedCount,
          total: prompts.length,
          sent: sentCount,
        });
      } finally {
        runningPromptsRef.current.delete(promptIndex);
      }
    };

    // Start prompts with proper concurrency control
    const processAllPrompts = async (): Promise<void> => {
      let promptIndex = 0;

      const processNext = async (): Promise<void> => {
        while (promptIndex < prompts.length && !cancelledRef.current) {
          while (
            runningPromptsRef.current.size >= maxConcurrentRunning &&
            !cancelledRef.current
          ) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }

          if (cancelledRef.current) break;

          const currentPromptIndex = promptIndex++;
          processSinglePrompt(currentPromptIndex);

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        while (runningPromptsRef.current.size > 0 && !cancelledRef.current) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }

        setIsRunning(false);
      };

      await processNext();
    };

    processAllPrompts();
  };

  const resetEvaluation = () => {
    cancelledRef.current = false;
    setIsRunning(false);
    setCurrentBatchId(null);
    setCurrentProgress({ completed: 0, total: 0, sent: 0 });
    runningPromptsRef.current.clear();
  };

  return {
    isRunning,
    currentBatchId,
    currentProgress,
    validation,
    startEvaluation,
    resetEvaluation,
  };
}
