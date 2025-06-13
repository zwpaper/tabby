import type { ApiClient } from "@/lib/auth-client";
import { getLogger } from "@/lib/logger";
import { TaskRunnerManager } from "@/lib/task-runner-manager";
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils";
import { toUIMessages } from "@ragdoll/common";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { container } from "tsyringe";

const logger = getLogger("NewTaskTool");

/**
 * Lists files and directories within the specified path
 */
export const newTask: ToolFunctionType<ClientToolsType["newTask"]> = async (
  { _meta: { uid } = {} },
  { abortSignal },
) => {
  if (!uid) {
    throw new Error("Task UID is required");
  }

  // FIXME(zhiming): abort newTask is not supported yet.
  abortSignal?.throwIfAborted();

  // Call the API to create a task
  const apiClient = container.resolve<ApiClient>("ApiClient");
  const taskRunnerManager = container.resolve(TaskRunnerManager);
  await taskRunnerManager.runTask(uid);

  // Fetch the task status after the runner has stopped
  const fetchTaskResp = await apiClient.api.tasks[":uid"].$get({
    param: { uid },
  });

  const noResultError = new Error("No result found");

  if (!fetchTaskResp.ok) {
    logger.debug(
      `Failed to fetch task ${uid} status: ${fetchTaskResp.statusText}`,
    );
    // FIXME(zhiming): handle retry
    throw noResultError;
  }

  const task = await fetchTaskResp.json();
  if (task.status !== "completed") {
    logger.debug(
      `Task ${uid} is not completed after runner stopped: ${task.status}`,
    );
    throw noResultError;
  }

  // Find the last attemptCompletion tool message
  const messages = toUIMessages(task.conversation?.messages || []);
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    logger.debug(`Task ${uid} has no messages.`);
    throw noResultError;
  }

  if (lastMessage.role === "assistant") {
    const part = lastMessage.parts.findLast(
      (
        part,
      ): part is ToolInvocationUIPart & {
        toolInvocation: { state: "result" };
      } =>
        part.type === "tool-invocation" &&
        part.toolInvocation.toolName === "attemptCompletion",
    );
    if (part) {
      logger.debug(`Task ${uid} submitted a result, returning it.`);
      return {
        result: part.toolInvocation.args.result,
      };
    }
  }

  logger.debug(`Task ${uid} did not submit a result.`);
  throw noResultError;
};
