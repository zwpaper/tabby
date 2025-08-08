import type { PendingToolCallApproval } from "@/features/approval";
import { useMcp } from "@/lib/hooks/use-mcp";
import { useTaskRunners } from "@/lib/hooks/use-task-runners";
import { type ToolUIPart, getToolName } from "@ai-v5-sdk/ai";
import { ToolsByPermission } from "@getpochi/tools";
import type { UITools } from "@ragdoll/livekit";
import { useAutoApprove } from "./use-auto-approve";

export function useToolAutoApproval(
  pendingApproval: PendingToolCallApproval,
  autoApproveGuard: boolean,
): boolean {
  const { autoApproveActive, autoApproveSettings } =
    useAutoApprove(autoApproveGuard);
  const { toolset } = useMcp();
  const runners = useTaskRunners();

  const isToolApproved = (tool: ToolUIPart<UITools>) => {
    const toolName = getToolName(tool);
    if (tool.type === "tool-newTask" && tool.state === "input-available") {
      const uid = tool.input._meta?.uid;
      if (uid && runners[uid]) {
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
