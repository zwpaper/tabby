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

  abortSignal?.throwIfAborted();
  abortSignal?.addEventListener("abort", () => {
    taskRunnerManager.stopTask(uid);
  });

  // FIXME(zhiming): pass user selected model id into task runner
  const runnerState = taskRunnerManager.startTask(uid, {});

  // biome-ignore lint/suspicious/noExplicitAny: pass thread signal
  const result = ThreadSignal.serialize(runnerState) as any;

  return { result };
};
