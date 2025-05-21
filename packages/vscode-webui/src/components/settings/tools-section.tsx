import { apiClient } from "@/lib/auth-client";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "../ui/skeleton";
import { Section } from "./section";
import { ToolBadgeList } from "./tool-badge";

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

  const renderToolsContent = () => {
    if (!toolsData || isLoading) {
      return (
        <div className="flex flex-wrap gap-2">
          {new Array(12).fill(null).map((_, i) => {
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
          })}
        </div>
      );
    }

    return <ToolBadgeList tools={toolsData} />;
  };

  return <Section title="Tools">{renderToolsContent()}</Section>;
};
