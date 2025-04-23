import type { ClientTools } from "@ragdoll/tools";
import { Box, Text } from "ink";
import type { ToolProps } from "./types";

export const AskFollowupQuestionTool: React.FC<
  ToolProps<(typeof ClientTools)["askFollowupQuestion"]>
> = ({ toolCall }) => {
  const followUp = (toolCall.args?.followUp || []).join(", ");
  const followUpPrompt = followUp ? `\nPossible follow-ups: ${followUp}` : "";
  const content = `${toolCall.args?.question}${followUpPrompt}`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="grey">Q: {content}</Text>
    </Box>
  );
};
