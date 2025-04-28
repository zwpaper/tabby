import type { ClientToolsType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import type { ToolProps } from "./types";

export const ReadFileTool: React.FC<ToolProps<ClientToolsType["readFile"]>> = ({
  toolCall,
}) => {
  const {
    path = "",
    startLine = undefined,
    endLine = undefined,
  } = toolCall.args || {}; // Extract startLine and endLine
  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { isTruncated } = toolCall.result;
      resultEl = (
        <Text>
          {toolCall.result.content.length} characters read
          {isTruncated ? ", truncated" : ""}
        </Text>
      );
    }
  }

  // Conditionally create the line range string
  const lineRange =
    startLine !== undefined || endLine !== undefined
      ? `[lines ${startLine ?? 1}-${endLine ?? "end"}]`
      : "";

  return (
    <Box gap={1} flexDirection="column">
      <Box gap={1}>
        <Text>Reading file</Text>
        <Text color="yellowBright">{path}</Text>
        {lineRange && <Text color="grey">{lineRange}</Text>}
      </Box>
      {resultEl}
    </Box>
  );
};
