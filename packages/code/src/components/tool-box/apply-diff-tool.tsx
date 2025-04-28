import type { ClientToolsType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import TruncatedText from "../truncated-text";
import type { ToolProps } from "./types";

export const ApplyDiffTool: React.FC<
  ToolProps<ClientToolsType["applyDiff"]>
> = ({ toolCall }) => {
  const {
    path = "",
    diff = "",
    startLine = 0,
    endLine = 0,
  } = toolCall.args || {};

  // Count the number of lines in the diff
  const lineCount = diff.split("\n").length;

  // Create the line range string
  const lineRange = `[lines ${startLine}-${endLine}]`;

  let resultEl: React.ReactNode = undefined;
  if (
    toolCall.state === "result" &&
    typeof toolCall.result === "object" &&
    toolCall.result !== null && // Added null check
    !("error" in toolCall.result)
    // Assuming a successful result doesn't contain an 'error' key
  ) {
    resultEl = <Text color="greenBright">Patch applied successfully.</Text>;
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Applying patch to</Text>
        <Text color="yellowBright">{path}</Text>
        <Text color="grey">{lineRange}</Text>
      </Box>
      <TruncatedText
        color="grey"
        maxLines={5}
        hiddenLinesSuffix={
          lineCount > 5 ? `more lines (${lineCount} total)` : "more lines"
        }
      >
        {diff}
      </TruncatedText>
      {resultEl}
    </Box>
  );
};
