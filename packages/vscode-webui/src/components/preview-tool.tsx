import { useToolCallLifeCycle } from "@/features/chat";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect, useMemo } from "react";
import { funnel } from "remeda";

export function PreviewTool({ messages }: { messages: UIMessage[] }) {
  const lastMessage = messages.at(-1);
  const components = lastMessage?.parts?.map((part) => {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state !== "result"
    ) {
      return (
        <PreviewOneTool
          key={part.toolInvocation.toolCallId}
          tool={part.toolInvocation}
        />
      );
    }
  });
  return <>{components}</>;
}

function PreviewOneTool({ tool }: { tool: ToolInvocation }) {
  const { getToolCallLifeCycle } = useToolCallLifeCycle();
  const { toolName, toolCallId } = tool;
  const debouncedPreview = useMemo(
    () =>
      funnel(
        (tool: ToolInvocation) => {
          const lifecycle = getToolCallLifeCycle(toolName, toolCallId);
          if (lifecycle.status === "init") {
            lifecycle.preview(tool.args, tool.state);
          }
        },
        {
          maxBurstDurationMs: 500,
          reducer: (_, rhs: ToolInvocation) => rhs,
        },
      ),
    [toolName, toolCallId, getToolCallLifeCycle],
  );
  useEffect(() => {
    debouncedPreview.call(tool);
  }, [tool, debouncedPreview]);

  return null;
}
