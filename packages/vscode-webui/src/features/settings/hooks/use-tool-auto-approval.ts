import type { PendingToolCallApproval } from "@/features/approval";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { ToolsByPermission } from "@ragdoll/tools";
import { useAutoApprove } from "./use-auto-approve";

export function useToolAutoApproval(
  pendingApproval: PendingToolCallApproval,
  autoApproveGuard: boolean,
): boolean {
  const toolName = pendingApproval.name;
  const { autoApproveActive, autoApproveSettings } =
    useAutoApprove(autoApproveGuard);
  const { toolset } = useMcp();
  const runners = useTaskRunners();

  if (
    toolName === "newTask" &&
    pendingApproval.tool.toolName === "newTask" &&
    pendingApproval.tool.state === "call"
  ) {
    const uid = pendingApproval.tool.args._meta?.uid;
    const runnerState = runners[uid];
    if (runnerState) {
      return true;
    }
  }

  if (ToolsByPermission.default.includes(toolName)) {
    return true;
  }

  if (!autoApproveActive) {
    return false;
  }

  if (autoApproveSettings.read && ToolsByPermission.read.includes(toolName)) {
    return true;
  }

  if (autoApproveSettings.write && ToolsByPermission.write.includes(toolName)) {
    return true;
  }

  if (
    autoApproveSettings.execute &&
    ToolsByPermission.execute.includes(toolName)
  ) {
    return true;
  }

  if (
    autoApproveSettings.mcp &&
    Object.keys(toolset).some((name) => name === toolName)
  ) {
    return true;
  }

  return false;
}
