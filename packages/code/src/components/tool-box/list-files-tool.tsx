import * as nodePath from "node:path";
import type { ListFilesInputType, ListFilesOutputType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const ListFilesTool: React.FC<
  ToolProps<ListFilesInputType, ListFilesOutputType>
> = ({ toolCall }) => {
  const { path, recursive } = toolCall.args;

  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { files, isTruncated } = toolCall.result;

      // Group files by directory for better visualization
      const filesByDir: Record<string, string[]> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dirPath = file.split("/").slice(0, -1).join("/") || ".";
        if (!filesByDir[dirPath]) {
          filesByDir[dirPath] = [];
        }
        filesByDir[dirPath].push(file.split("/").pop() || "");
      }

      const filesContent = (
        <Box flexDirection="column">
          {Object.entries(filesByDir).map(([dir, dirFiles], idx) => (
            <Box key={idx} flexDirection="column" marginLeft={1} marginTop={1}>
              <Text color="blueBright">{dir}/</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text color="yellowBright">{dirFiles.join(", ")}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      );

      // Determine if we should collapse the file list
      const shouldCollapse = Object.entries(filesByDir).length > 5;

      resultEl = (
        <Box flexDirection="column">
          <Text>
            Found {files.length} files{isTruncated ? " (truncated)" : ""}
          </Text>
          {shouldCollapse ? (
            <Collapsible title={`Files (${files.length})`} open={false}>
              {filesContent}
            </Collapsible>
          ) : (
            filesContent
          )}
        </Box>
      );
    }
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
