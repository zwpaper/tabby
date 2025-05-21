import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../ui/skeleton";

interface Tool {
  id: string;
  description: string;
}

export const ToolsSection: React.FC = () => {
  const { data: toolsData, isLoading } = useQuery({
    queryKey: ["tools"],
    queryFn: async () => {
      const res = await apiClient.api.tools.$get();
      if (!res.ok) {
        throw new Error("Failed to fetch available tools");
      }
      return res.json() as Promise<Tool[]>;
    },
  });

  return (
    <div className="py-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="ml-1 font-bold text-base">Tools</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {!toolsData || isLoading ? (
          new Array(12).fill(null).map((_, i) => {
            const randomWidth = (Math.floor(Math.random() * 20) + 10) * 0.3;
            return (
              <Skeleton
                key={i}
                style={{
                  width: `${randomWidth}rem`,
                }}
                className="h-6 bg-secondary"
              />
            );
          })
        ) : (
          <TooltipProvider>
            {toolsData.map((tool) => (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="cursor-pointer">
                    {tool.id}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-80 text-xs">
                  <pre className="text-wrap">{tool.description}</pre>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
};
