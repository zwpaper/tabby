import { useToolCallLifeCycle } from "@/features/chat";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect, useMemo } from "react";
import { funnel } from "remeda";

export function PreviewTool({ messages }: { messages: UIMessage[] }) {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return null;
  }
  const components = lastMessage.parts?.map((part) => {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state !== "result"
    ) {
      return (
        <PreviewOneTool
          key={part.toolInvocation.toolCallId}
          tool={part.toolInvocation}
          messageId={lastMessage.id}
        />
      );
    }
  });
  return <>{components}</>;
}

function PreviewOneTool({
  tool,
  messageId,
}: { tool: ToolInvocation; messageId: string }) {
  const { getToolCallLifeCycle } = useToolCallLifeCycle();
  const debouncedPreview = useMemo(
    () =>
      funnel(
        (tool: ToolInvocation) => {
          const lifecycle = getToolCallLifeCycle({
            toolName: tool.toolName,
            toolCallId: tool.toolCallId,
            messageId,
          });
          if (lifecycle.status === "init") {
            lifecycle.preview(tool.args, tool.state, tool.step);
          }
        },
        {
          maxBurstDurationMs: 500,
          reducer: (_, rhs: ToolInvocation) => rhs,
        },
      ),
    [getToolCallLifeCycle, messageId],
  );
  useEffect(() => {
    debouncedPreview.call(tool);
  }, [tool, debouncedPreview]);

  return null;
}
