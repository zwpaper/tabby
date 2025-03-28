import type { ApplyDiffInputType, ApplyDiffOutputType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const ApplyDiffTool: React.FC<
  ToolProps<ApplyDiffInputType, ApplyDiffOutputType>
> = ({ toolCall }) => {
  const { path, diff, startLine, endLine } = toolCall.args;

  // Count the number of lines in the diff
  const lineCount = diff.split("\n").length;
  const shouldCollapse = lineCount > 5;

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
      {shouldCollapse ? (
        <Collapsible title={`Patch (${lineCount} lines)`} open={false}>
          <Text color="grey">{diff}</Text>
        </Collapsible>
      ) : (
        <Text color="grey">{diff}</Text>
      )}
      {resultEl}
    </Box>
  );
};
