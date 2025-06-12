import { VSCodeHostImpl } from "@/integrations/webview/vscode-host-impl";
import type { ApiClient } from "@/lib/auth-client";
import { getLogger } from "@/lib/logger";
import { TaskRunnerManager } from "@/lib/task-runner-manager";
import type { ToolInvocationUIPart } from "@ai-sdk/ui-utils";
import { fromUIMessage, toUIMessages } from "@ragdoll/common";
import {
  type ClientToolsType,
  type ToolFunctionType,
  ToolsByPermission,
} from "@ragdoll/tools";
import { generateId } from "ai";
import { container } from "tsyringe";

const logger = getLogger("NewTaskTool");

/**
 * Lists files and directories within the specified path
 */
export const newTask: ToolFunctionType<ClientToolsType["newTask"]> = async (
  { prompt },
  { abortSignal },
) => {
  // FIXME(zhiming): abort newTask is not supported yet.
  abortSignal?.throwIfAborted();

  const createTaskError = new Error("Failed to create task.");

  // Get environment
  const vscodeHost = container.resolve(VSCodeHostImpl);
  const environment = await vscodeHost.readEnvironment();

  // Call the API to create a task
  const apiClient = container.resolve<ApiClient>("ApiClient");
  const createTaskResp = await apiClient.api.chat.stream.$post({
    json: {
      message: fromUIMessage({
        id: generateId(),
        role: "user",
        content: prompt,
        parts: [{ type: "text", text: prompt }],
      }),
      environment,
    },
  });

  if (!createTaskResp.ok) {
    const error = await createTaskResp.text();
    logger.debug(
      `Failed to create task ${createTaskResp.statusText}: ${error}`,
    );
    // FIXME(zhiming): handle retry
    throw createTaskError;
  }

  const taskUid = createTaskResp.headers.get("Pochi-Task-Id");
  if (!taskUid) {
    logger.debug("Failed to create task: Pochi-Task-Id header is missing.");
    // FIXME(zhiming): handle retry
    throw createTaskError;
  }

  const noResultError = new Error("Task did not submit a result.");

  // Run the newTask in background
  const taskRunnerManager = container.resolve(TaskRunnerManager);
  await taskRunnerManager.runTask(taskUid, {
    allowedTools: [...ToolsByPermission.read, ...ToolsByPermission.default],
  });

  // Fetch the task status after the runner has stopped
  const fetchTaskResp = await apiClient.api.tasks[":uid"].$get({
    param: { uid: taskUid.toString() },
  });

  if (!fetchTaskResp.ok) {
    logger.debug(
      `Failed to fetch task ${taskUid} status: ${fetchTaskResp.statusText}`,
    );
    // FIXME(zhiming): handle retry
    throw noResultError;
  }

  const task = await fetchTaskResp.json();
  if (task.status !== "completed") {
    logger.debug(
      `Task ${taskUid} is not completed after runner stopped: ${task.status}`,
    );
    throw noResultError;
  }

  // Find the last attemptCompletion tool message
  const messages = toUIMessages(task.conversation?.messages || []);
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    logger.debug(`Task ${taskUid} has no messages.`);
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
      logger.debug(`Task ${taskUid} submitted a result, returning it.`);
      return {
        result: part.toolInvocation.args.result,
      };
    }
  }

  logger.debug(`Task ${taskUid} did not submit a result.`);
  throw noResultError;
};
