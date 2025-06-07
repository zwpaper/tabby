import { useToolCallLifeCycle } from "@/features/chat";
import type { ToolInvocation, UIMessage } from "ai";
import { useEffect } from "react";

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
  useEffect(() => {
    const lifecycle = getToolCallLifeCycle(tool.toolName, tool.toolCallId);
    if (lifecycle.status === "init") {
      lifecycle.preview(tool.args, tool.state);
    }
  }, [tool, getToolCallLifeCycle]);

  return null;
}
