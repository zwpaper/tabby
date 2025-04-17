import * as nodePath from "node:path";
import type { GlobFilesFunctionType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import { FileList } from "./file-list"; // Import the new component
import type { ToolProps } from "./types";

export const GlobFilesTool: React.FC<ToolProps<GlobFilesFunctionType>> = ({
  toolCall,
}) => {
  const { path = "", globPattern = "" } = toolCall.args || {};

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
    // Note: Error handling could be added here similar to list-files if needed
  }

  // Assuming process.cwd() is available
  const absolutePath = nodePath.join(process.cwd(), path);

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Searching files in </Text>
        <Text color="yellowBright">{absolutePath}</Text>
        <Text> matching </Text>
        <Text color="cyanBright">{globPattern}</Text>
      </Box>
      {resultEl}
    </Box>
  );
};
