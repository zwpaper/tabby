import { TaskRunnerManager } from "@/lib/task-runner-manager";
import { ThreadSignal } from "@quilted/threads/signals";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import { container } from "tsyringe";

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

  const taskRunnerManager = container.resolve(TaskRunnerManager);
  taskRunnerManager.runTask(uid, { abortSignal });

  return {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    result: ThreadSignal.serialize(taskRunnerManager.status) as any,
  };
};
