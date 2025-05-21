import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type React from "react";

export interface ToolBadgeProps {
  id: string;
  description: string;
}

export const ToolBadge: React.FC<ToolBadgeProps> = ({ id, description }) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="cursor-pointer">
          {id}
        </Badge>
      </TooltipTrigger>
      <TooltipContent className="max-w-80 text-xs">
        <pre className="text-wrap">{description}</pre>
      </TooltipContent>
    </Tooltip>
  );
};

export const ToolBadgeList: React.FC<{
  tools: ToolBadgeProps[];
}> = ({ tools }) => {
  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-2">
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
