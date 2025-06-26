import { useSendMessage } from "@/features/chat";
import { cn } from "@/lib/utils";
import type { ClientToolsType } from "@ragdoll/tools";
import type { ToolProps } from "../types";

export const AskFollowupQuestionTool: React.FC<
  ToolProps<ClientToolsType["askFollowupQuestion"]>
> = ({ tool: toolCall, isLoading }) => {
  const sendMessage = useSendMessage();
  const { question, followUp } = toolCall.args || {};

  return (
    <div className="flex flex-col gap-2">
      <p className="items-center font-medium italic">{question}</p>
      {followUp &&
        followUp.length > 0 && ( // Check if followUp exists and has items
          <ol className="flex list-decimal flex-col gap-1 pl-8">
            {followUp.map((followUpText, index) => (
              <li
                key={index}
                className="text-muted-foreground hover:text-foreground"
              >
                <button
                  type="button"
                  className={cn("w-full text-left", {
                    "cursor-pointer": !isLoading,
                    "cursor-wait": isLoading,
                  })}
                  disabled={isLoading}
                  onClick={() =>
                    sendMessage({
                      prompt: followUpText,
                    })
                  }
                >
                  {followUpText}
                </button>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
};
