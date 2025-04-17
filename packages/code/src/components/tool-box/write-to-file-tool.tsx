import type { WriteToFileFunctionType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import TruncatedText from "../truncated-text";
import type { ToolProps } from "./types";

export const WriteToFileTool: React.FC<ToolProps<WriteToFileFunctionType>> = ({
  toolCall,
}) => {
  const { path = "", content = "" } = toolCall.args || {};

  // Count the number of lines in the content
  const lineCount = content.split("\n").length;
  const contentLength = content.length;

  let resultEl: React.ReactNode;
  if (
    toolCall.state === "result" &&
    typeof toolCall.result === "object" &&
    toolCall.result !== null && // Added null check
    !("error" in toolCall.result)
  ) {
    resultEl = <Text color="greenBright">File written successfully.</Text>;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Writing to file</Text>
        <Text color="yellowBright">{path}</Text>
        <Text>
          ({contentLength} characters, {lineCount} lines)
        </Text>
      </Box>
      <TruncatedText
        color="grey"
        maxLines={5}
        hiddenLinesSuffix={`more lines (${lineCount} total)`}
      >
        {content}
      </TruncatedText>
      {resultEl}
    </Box>
  );
};
