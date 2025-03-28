import type {
  AttemptCompletionInputType,
  AttemptCompletionOutputType,
} from "@ragdoll/tools";
import { Box, Text } from "ink";
import Markdown from "../markdown";
import type { ToolProps } from "./types";

export const TaskCompleteTool: React.FC<
  ToolProps<AttemptCompletionInputType, AttemptCompletionOutputType>
> = ({ toolCall }) => {
  const { result, command } = toolCall.args;
  return (
    <Box flexDirection="column" gap={1}>
      <Text color="greenBright">Task Complete</Text>
      <Markdown>{result}</Markdown>
      {command && <Text>Please run `{command}` to check the result.</Text>}
    </Box>
  );
};
