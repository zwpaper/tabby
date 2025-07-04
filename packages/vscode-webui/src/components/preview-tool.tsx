import { useToolCallLifeCycle } from "@/features/chat";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect, useMemo } from "react";
import { funnel } from "remeda";

export function PreviewTool({ messages }: { messages: UIMessage[] }) {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    return null;
  }
  const isFirstAssistantMessage =
    lastMessage.role === "assistant" && messages.length === 2;
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
          isFirstAssistantMessage={isFirstAssistantMessage}
        />
      );
    }
  });
  return <>{components}</>;
}

function PreviewOneTool({
  tool,
  messageId,
  isFirstAssistantMessage,
}: {
  tool: ToolInvocation;
  messageId: string;
  isFirstAssistantMessage: boolean;
}) {
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
            lifecycle.preview(
              tool.args,
              tool.state,
              tool.step !== undefined
                ? {
                    isFirstAssistantMessage,
                    step: tool.step,
                  }
                : undefined,
            );
          }
        },
        {
          maxBurstDurationMs: 500,
          reducer: (_, rhs: ToolInvocation) => rhs,
        },
      ),
    [getToolCallLifeCycle, messageId, isFirstAssistantMessage],
  );
  useEffect(() => {
    debouncedPreview.call(tool);
  }, [tool, debouncedPreview]);

  return null;
}
