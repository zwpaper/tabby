import { MessageMarkdown } from "@/components/message-markdown";
import type { ClientToolsType } from "@ragdoll/tools";
import { Check } from "lucide-react";
import type { ToolProps } from "../types";

export const AttemptCompletionTool: React.FC<
  ToolProps<ClientToolsType["attemptCompletion"]>
> = ({ tool: toolCall }) => {
  const { result = "" } = toolCall.args || {};

  // Return null if there's nothing to display
  if (!result) {
    return null;
  }

  return (
    <div className="flex flex-col">
      <span className="flex gap-2 items-center font-bold text-emerald-300 text-sm">
        <Check className="size-4" />
        Task Completed
      </span>
      <MessageMarkdown>{result}</MessageMarkdown>
    </div>
  );
};
