import * as nodePath from "node:path";
import type { ListFilesFunctionType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import { FileList } from "./file-list"; // Import the new component
import type { ToolProps } from "./types";

export const ListFilesTool: React.FC<ToolProps<ListFilesFunctionType>> = ({
  toolCall,
}) => {
  const { path = "", recursive = false } = toolCall.args || {};

  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { files, isTruncated } = toolCall.result;
      // Assuming process.cwd() is available
      const absoluteBasePath = nodePath.join(process.cwd(), path);

      resultEl = (
        <FileList
          files={files}
          basePath={absoluteBasePath} // Pass the base path for relative display
          isTruncated={isTruncated}
          maxDirectories={5}
        />
      );
    }
    // Note: Error handling could be added here if needed
  }

  // Assuming process.cwd() is available in this environment
  // If not, this might need adjustment based on how the CWD is obtained.
  const absolutePath = nodePath.join(process.cwd(), path);
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Listing files in </Text>
        <Text color="yellowBright">{absolutePath}</Text>
        {recursive && <Text> (recursive)</Text>}
      </Box>
      {resultEl}
    </Box>
  );
};
