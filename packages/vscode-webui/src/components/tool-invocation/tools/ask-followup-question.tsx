import type { ClientToolsType } from "@ragdoll/tools";
import type { ToolProps } from "../types";

export const AskFollowupQuestionTool: React.FC<
  ToolProps<ClientToolsType["askFollowupQuestion"]>
> = ({ tool: toolCall, sendMessage, isLoading }) => {
  const { question, followUp } = toolCall.args || {};

  return (
    <div className="flex flex-col gap-2">
      <p className="items-center font-medium italic">{question}</p>
      {followUp &&
        followUp.length > 0 && ( // Check if followUp exists and has items
          <ol className="flex list-inside list-decimal flex-col gap-1 pl-4">
            {followUp.map((followUpText, index) => (
              <li
                key={index}
                className={`cursor-pointer text-muted-foreground ${
                  isLoading
                    ? "pointer-events-none opacity-50"
                    : "hover:text-foreground"
                }`}
              >
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    !isLoading &&
                    sendMessage({
                      content: followUpText,
                      role: "user",
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
