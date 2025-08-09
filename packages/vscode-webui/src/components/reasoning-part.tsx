import { Dot, Lightbulb } from "lucide-react";

import { MessageMarkdown } from "@/components/message/markdown";
import { cn, tw } from "@/lib/utils";
import type { ReasoningUIPart } from "@ai-v5-sdk/ai";
import { ExpandableToolContainer } from "./tool-invocation/tool-container";

interface ReasoningPartUIProps {
  isLoading: boolean;
  part: ReasoningUIPart;
  className?: string;
}

export function ReasoningPartUI({
  className,
  part,
  isLoading,
}: ReasoningPartUIProps) {
  const iconClass = tw`text-blue-700 dark:text-blue-300`;
  const title = (
    <span className="flex items-center gap-2">
      {isLoading ? (
        <Dot
          className={cn(
            "size-4 scale-150 animate-ping duration-2000",
            iconClass,
          )}
        />
      ) : (
        <Lightbulb className={cn("size-4 scale-90", iconClass)} />
      )}
      <span className="font-medium italic">Pochi is thinking ...</span>
    </span>
  );

  const detail = <MessageMarkdown>{part.text}</MessageMarkdown>;

  return (
    <div className={className}>
      <ExpandableToolContainer title={title} expandableDetail={detail} />
    </div>
  );
}
