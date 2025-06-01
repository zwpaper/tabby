import { useMcp } from "@/lib/hooks/use-mcp";
import { ToolsByPermission } from "@ragdoll/tools";
import { useAutoApprove } from "./use-auto-approve";

export function useToolAutoApproval(
  toolName: string,
  autoApproveGuard: boolean,
): boolean {
  const { autoApproveActive, autoApproveSettings } =
    useAutoApprove(autoApproveGuard);
  const { toolset } = useMcp();

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
