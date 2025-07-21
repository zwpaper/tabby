import type { PendingToolCallApproval } from "@/features/approval";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { ToolsByPermission } from "@ragdoll/tools";
import type { ToolInvocation } from "ai";
import { useAutoApprove } from "./use-auto-approve";

export function useToolAutoApproval(
  pendingApproval: PendingToolCallApproval,
  autoApproveGuard: boolean,
): boolean {
  const { autoApproveActive, autoApproveSettings } =
    useAutoApprove(autoApproveGuard);
  const { toolset } = useMcp();
  const runners = useTaskRunners();

  const isToolApproved = (tool: ToolInvocation) => {
    const { toolName } = tool;
    if (toolName === "newTask" && tool.state === "call") {
      const uid = tool.args._meta?.uid;
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

    if (
      autoApproveSettings.write &&
      ToolsByPermission.write.includes(toolName)
    ) {
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
  };

  if ("tools" in pendingApproval) {
    return pendingApproval.tools.every(isToolApproved);
  }

  return isToolApproved(pendingApproval.tool);
}
