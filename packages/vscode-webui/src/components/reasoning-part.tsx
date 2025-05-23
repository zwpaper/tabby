import type { ReasoningUIPart } from "@ai-sdk/ui-utils";
import { ChevronDown, ChevronRight, Dot } from "lucide-react";
import { useState } from "react";

import { MessageMarkdown } from "@/components/message/markdown";
import { useSettingsStore } from "@/lib/stores/settings-store";

interface ReasoningPartUIProps {
  isLoading: boolean;
  part: ReasoningUIPart;
}

export function ReasoningPartUI({ part, isLoading }: ReasoningPartUIProps) {
  const showThinking = useSettingsStore((x) => x.showThinking);
  const [showDetails, setShowDetails] = useState(false);

  if (!showThinking) {
    return null;
  }

  return (
    <div className="flex items-start">
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="mt-1 mr-2 flex-shrink-0"
        aria-label={showDetails ? "Hide details" : "Show details"}
      >
        {showDetails ? (
          <ChevronDown className="size-4" />
        ) : (
          <ChevronRight className="size-4" />
        )}
      </button>
      <div className="flex-grow">
        <div
          className="cursor-pointer font-medium italic"
          onClick={() => setShowDetails(!showDetails)} // Also allow clicking text to toggle
        >
          Pochi is thinking
          {isLoading && (
            <Dot className="inline-block size-6 animate-ping duration-2000" />
          )}
        </div>
        {showDetails && (
          <div className="pt-2">
            <MessageMarkdown>{part.reasoning}</MessageMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}
