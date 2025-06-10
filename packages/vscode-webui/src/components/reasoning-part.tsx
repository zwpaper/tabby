import type { ReasoningUIPart } from "@ai-sdk/ui-utils";
import { Dot, Lightbulb } from "lucide-react";

import { MessageMarkdown } from "@/components/message/markdown";
import { cn, tw } from "@/lib/utils";
import { ExpandableToolContainer } from "./tool-invocation/tool-container";

interface ReasoningPartUIProps {
  isLoading: boolean;
  part: ReasoningUIPart;
}

export function ReasoningPartUI({ part, isLoading }: ReasoningPartUIProps) {
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

  const detail = <MessageMarkdown>{part.reasoning}</MessageMarkdown>;

  return <ExpandableToolContainer title={title} expandableDetail={detail} />;
}
