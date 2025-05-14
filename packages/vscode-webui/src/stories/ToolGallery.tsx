import { ToolInvocationPart } from "@/components/tool-invocation";
import type { ToolInvocation } from "@/components/tool-invocation/types";

export const ToolsGallery: React.FC<{
  tools: ToolInvocation<unknown, unknown>[];
}> = ({ tools }) => {
  return (
    <div className="mt-3 ml-1 flex flex-col gap-2">
      {tools.map((tool, index) => (
        <ToolInvocationPart
          key={tool.toolCallId + index}
          tool={tool}
          sendMessage={() => Promise.resolve(undefined)}
          executingToolCallId={undefined}
          isLoading={false}
        />
      ))}
    </div>
  );
};
