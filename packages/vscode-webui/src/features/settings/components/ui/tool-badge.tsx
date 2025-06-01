import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { WrenchIcon } from "lucide-react";
import type React from "react";

export interface ToolBadgeProps {
  id: string;
  href?: string;
  disabled?: boolean;
  description?: string;
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({
  id,
  href,
  disabled,
  description,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <a href={href} rel="noopener noreferrer" className="cursor-pointer">
          <Badge
            variant="secondary"
            className={cn({
              "line-through opacity-60": !!disabled,
            })}
          >
            {id}
          </Badge>
        </a>
      </TooltipTrigger>
      {description && (
        <TooltipContent className="max-w-80 text-sm">
          <h3 className="mb-1 flex items-center gap-2 font-semibold">
            <WrenchIcon className="size-4" />
            {id}
          </h3>
          <ScrollArea className="max-h-40 overflow-y-auto">
            {description}
          </ScrollArea>
        </TooltipContent>
      )}
    </Tooltip>
  );
};

export const ToolBadgeList: React.FC<{
  tools: ToolBadgeProps[];
}> = ({ tools }) => {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-foreground/60 text-sm">
          BUILT-IN:{" "}
        </span>
        {tools.map((tool) => (
          <ToolBadge
            key={tool.id}
            id={tool.id}
            description={tool.description}
          />
        ))}
      </div>
    </TooltipProvider>
  );
};
