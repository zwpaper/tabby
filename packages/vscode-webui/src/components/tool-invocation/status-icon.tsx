import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
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
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <X className="size-4 text-red-400 cursor-help" />
          </TooltipTrigger>
          <TooltipContent className="px-1 py-0.5 rounded bg-secondary">
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else if (tool.state === "result") {
    statusIcon = <Check className="size-4 text-emerald-300" />;
  } else if (isExecuting || tool.state === "partial-call") {
    statusIcon = <Loader2 className="size-4 animate-spin text-zinc-400" />;
  }
  return statusIcon;
}
