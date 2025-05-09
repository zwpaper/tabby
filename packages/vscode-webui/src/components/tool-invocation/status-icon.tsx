import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ToolInvocation } from "ai";
import { Check, CircleSmall, Loader2, Pause, X } from "lucide-react";

interface StatusIconProps {
  tool: ToolInvocation;
  isExecuting: boolean;
  className?: string;
}

export function StatusIcon({ tool, isExecuting, className }: StatusIconProps) {
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
            <X className="size-4 cursor-help text-red-400" />
          </TooltipTrigger>
          <TooltipContent>
            <p>{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  } else if (tool.state === "result") {
    statusIcon = <Check className="size-4 text-emerald-300" />;
  } else if (tool.state === "partial-call") {
    statusIcon = (
      <CircleSmall className="size-4 animate-bounce text-zinc-400" />
    );
  } else if (isExecuting) {
    statusIcon = <Loader2 className="size-4 animate-spin text-zinc-400" />;
  }
  return (
    <div className={cn("inline-block align-sub", className)}>{statusIcon}</div>
  );
}
