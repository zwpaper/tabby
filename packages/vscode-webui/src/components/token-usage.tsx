import { FileList } from "@/components/tool-invocation/file-list";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRules } from "@/lib/hooks/use-rules";
import { CompactTaskMinTokens } from "@ragdoll/common";
import { useState } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";

interface Props {
  contextWindow: number;
  totalTokens: number;
  className?: string;
  compact?: {
    isCompactingTask: boolean;
    handleCompactTask: () => void;
    isCompactingNewTask: boolean;
    handleCompactNewTask: () => void;
    enabled: boolean;
  };
}

export function TokenUsage({
  totalTokens,
  contextWindow,
  className,
  compact,
}: Props) {
  const percentage = Math.ceil((totalTokens / contextWindow) * 100);
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);

  const { rules } = useRules();

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  const handleClick = () => {
    if (isPinned) {
      setIsPinned(false);
      setIsOpen(false);
    } else {
      setTimeout(() => {
        setIsPinned(true);
        setIsOpen(true);
      }, 0);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // If popover is closing for any reason, it should be unpinned
      setIsPinned(false);
    }
  };

  const minTokenTooltip =
    totalTokens < CompactTaskMinTokens ? (
      <TooltipContent>
        <p>
          A task must have at least {CompactTaskMinTokens} tokens to be
          compacted.
        </p>
      </TooltipContent>
    ) : null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        asChild
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div
          className={cn(
            "cursor-pointer overflow-x-hidden rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted hover:text-foreground",
            className,
          )}
        >
          <span className="select-none whitespace-nowrap font-medium">
            {percentage}% of {formatTokens(contextWindow)} tokens
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 border"
        sideOffset={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-y-4 text-xs">
          {rules?.length > 0 && (
            <div className="flex flex-col gap-y-1">
              <div className="mb-1 text-muted-foreground">Rules</div>
              <div>
                <FileList
                  matches={rules.map((item) => ({
                    file: item.relativeFilepath ?? item.filepath,
                    label: item.label,
                  }))}
                  showBaseName={false}
                />
              </div>
            </div>
          )}
          <div className="flex flex-col gap-y-1">
            <div className="mb-1 text-muted-foreground">Context Window</div>
            <div>
              <Progress value={percentage} className="mb-1" />
              {formatTokens(totalTokens)} of {formatTokens(contextWindow)} used
            </div>
          </div>
          {false && (
            <div className="mt-2 flex items-center gap-x-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          compact?.handleCompactNewTask();
                          setIsOpen(false);
                        }}
                        disabled={!compact?.enabled}
                      >
                        {compact?.isCompactingNewTask
                          ? "Compacting..."
                          : "New Task with Summary"}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {minTokenTooltip}
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => {
                          compact?.handleCompactTask();
                          setIsOpen(false);
                        }}
                        disabled={!compact?.enabled}
                      >
                        {compact?.isCompactingTask
                          ? "Compacting..."
                          : "Compact Task"}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {minTokenTooltip}
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function formatTokens(tokens: number | null | undefined): string {
  if (tokens == null || tokens === 0) {
    return "0";
  }
  const k = 1000;
  const m = k * 1000;
  const g = m * 1000;
  // Add T, P, E if needed

  let value: number;
  let unit: string;

  if (tokens >= g) {
    value = tokens / g;
    unit = "G";
  } else if (tokens >= m) {
    value = tokens / m;
    unit = "M";
  } else if (tokens >= k) {
    value = tokens / k;
    unit = "k";
  } else {
    return tokens.toString(); // Return the number as is if less than 1k
  }

  // Format to one decimal place
  let formattedValue = value.toFixed(1);

  // If it ends with .0, remove .0
  if (formattedValue.endsWith(".0")) {
    formattedValue = formattedValue.substring(0, formattedValue.length - 2);
  }

  return `${formattedValue}${unit}`;
}
