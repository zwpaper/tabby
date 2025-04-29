import type { ToolInvocation } from "ai";
import { Check, Loader2, Pause, X } from "lucide-react";

interface StatusIconProps {
  tool: ToolInvocation;
  isExecuting: boolean;
}

export function StatusIcon({ tool, isExecuting }: StatusIconProps) {
  let error: string | undefined;
  if (
    tool.state === "result" &&
    "error" in tool.result &&
    typeof tool.result.error === "string"
  ) {
    error = tool.result.error;
  }

  let statusIcon = <Pause className="size-4 text-zinc-400" />;
  if (error) {
    statusIcon = (
      <span title={error}>
        <X className="size-4 text-red-400" />
      </span>
    );
  } else if (tool.state === "result") {
    statusIcon = <Check className="size-4 text-green-400" />;
  } else if (isExecuting) {
    statusIcon = <Loader2 className="size-4 animate-spin text-zinc-400" />;
  }
  return statusIcon;
}
