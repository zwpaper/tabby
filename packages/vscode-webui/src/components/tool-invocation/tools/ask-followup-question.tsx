import type { ClientToolsType } from "@ragdoll/tools";
import type { ToolProps } from "../types";

export const AskFollowupQuestionTool: React.FC<
  ToolProps<ClientToolsType["askFollowupQuestion"]>
> = ({ tool: toolCall, setInput }) => {
  const { question, followUp } = toolCall.args || {};

  return (
    <div className="flex flex-col gap-2">
      <p className="items-center font-medium italic">{question}</p>
      {followUp &&
        followUp.length > 0 && ( // Check if followUp exists and has items
          <ol className="flex flex-col gap-1 pl-4 list-decimal list-inside">
            {followUp.map((followUpText, index) => (
              <li
                key={index}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <button type="button" onClick={() => setInput(followUpText)}>
                  {followUpText}
                </button>
              </li>
            ))}
          </ol>
        )}
    </div>
  );
};
