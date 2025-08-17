import type { PendingToolCallApproval } from "@/features/approval";
import { useMcp } from "@/lib/hooks/use-mcp";
import { type UITools, catalog } from "@getpochi/livekit";
import { ToolsByPermission } from "@getpochi/tools";
import { useStore } from "@livestore/react";
import { type ToolUIPart, getToolName } from "ai";
import { useAutoApprove } from "./use-auto-approve";

export function useToolAutoApproval(
  pendingApproval: PendingToolCallApproval,
  autoApproveGuard: boolean,
): boolean {
  const { autoApproveActive, autoApproveSettings } =
    useAutoApprove(autoApproveGuard);
  const { store } = useStore();
  const { toolset } = useMcp();

  const isToolApproved = (tool: ToolUIPart<UITools>) => {
    const toolName = getToolName(tool);
    if (tool.type === "tool-newTask" && tool.state === "input-available") {
      const countMessages = store.query(
        catalog.queries.makeMessagesQuery(tool.input._meta?.uid || ""),
      ).length;
      // If the task has already started, approve it automatically.
      return countMessages > 1;
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
