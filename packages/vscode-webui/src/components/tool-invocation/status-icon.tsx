import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/lib/hooks/use-copy-to-clipboard";
import { useIsDevMode } from "@/lib/hooks/use-is-dev-mode";
import { cn } from "@/lib/utils";
import type { ToolInvocation } from "ai";
import {
  Check,
  CheckIcon,
  CircleSmall,
  FilesIcon,
  Loader2,
  Pause,
  X,
} from "lucide-react";

interface StatusIconProps {
  tool: ToolInvocation;
  isExecuting: boolean;
  className?: string;
}

export function StatusIcon({ tool, isExecuting, className }: StatusIconProps) {
  const [isDevMode] = useIsDevMode();
  const { isCopied, copyToClipboard } = useCopyToClipboard({ timeout: 2000 });
  let error: string | undefined;
  if (
    tool.state === "result" &&
    typeof tool.result === "object" &&
    "error" in tool.result &&
    typeof tool.result.error === "string"
  ) {
    error = tool.result.error;
  }

  const devButton = (
    <span
      onClick={() => copyToClipboard(JSON.stringify(tool, null, 2))}
      className="my-1 flex cursor-pointer items-center rounded px-2 py-1 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
    >
      {isCopied ? (
        <CheckIcon size={12} className="inline text-sm text-success" />
      ) : (
        <FilesIcon className="inline" size={12} />
      )}
      <span className="ml-2 text-sm">Copy Tool Result</span>
    </span>
  );

  const tooltipContent = [];

  if (isDevMode) {
    tooltipContent.push(devButton);
  }

  let statusIcon = (
    <Pause className="size-4 text-zinc-500 dark:text-zinc-400" />
  );
  if (error) {
    statusIcon = <X className="size-4 cursor-help text-error" />;
    tooltipContent.push(<p>{error}</p>);
  } else if (tool.state === "result") {
    statusIcon = (
      <Check className="size-4 text-emerald-700 dark:text-emerald-300" />
    );
  } else if (tool.state === "partial-call") {
    statusIcon = (
      <CircleSmall className="size-4 animate-bounce text-zinc-500 dark:text-zinc-400" />
    );
  } else if (isExecuting) {
    statusIcon = (
      <Loader2 className="size-4 animate-spin text-zinc-500 dark:text-zinc-400" />
    );
  }

  if (tooltipContent.length > 0) {
    statusIcon = (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{statusIcon}</TooltipTrigger>
          <TooltipContent className="max-w-[calc(100vw-30px)]">
            {tooltipContent.map((item, index) => (
              <div className="text-wrap break-words" key={index}>
                {item}
              </div>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("inline-block align-sub", className)}>{statusIcon}</div>
  );
}
