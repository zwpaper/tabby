import * as nodePath from "node:path";
import { Box, Text } from "ink";
import Collapsible from "../collapsible";

interface FileListProps {
  files: string[];
  basePath?: string; // Optional base path to make file paths relative if needed
  title?: string;
  isTruncated?: boolean;
  collapseThreshold?: number; // Number of directories before collapsing
}

// Helper function to group files by directory
const groupFilesByDirectory = (
  files: string[],
  basePath?: string,
): Record<string, string[]> => {
  const filesByDir: Record<string, string[]> = {};
  for (const file of files) {
    // Determine the relative path if basePath is provided
    const displayPath = basePath ? nodePath.relative(basePath, file) : file;
    const dirPath = nodePath.dirname(displayPath) || ".";
    const fileName = nodePath.basename(displayPath);

    if (!filesByDir[dirPath]) {
      filesByDir[dirPath] = [];
    }
    // Ensure filename is not empty before pushing
    if (fileName) {
      filesByDir[dirPath].push(fileName);
    }
  }
  return filesByDir;
};

export const FileList: React.FC<FileListProps> = ({
  files,
  basePath,
  title,
  isTruncated = false,
  collapseThreshold = 5,
}) => {
  if (!files || files.length === 0) {
    return <Text>No files found.</Text>;
  }

  const filesByDir = groupFilesByDirectory(files, basePath);
  const directoryCount = Object.keys(filesByDir).length;

  const filesContent = (
    <Box flexDirection="column">
      {Object.entries(filesByDir).map(([dir, dirFiles], idx) => (
        <Box key={idx} flexDirection="column" marginLeft={1} marginTop={1}>
          <Text color="blueBright">{dir}/</Text>
          <Box flexDirection="column" marginLeft={2}>
            {/* Display files comma-separated */}
            <Text color="yellowBright">{dirFiles.join(", ")}</Text>
          </Box>
        </Box>
      ))}
    </Box>
  );

  const shouldCollapse = directoryCount > collapseThreshold;
  const displayTitle =
    title ||
    `Found ${files.length} file${files.length !== 1 ? "s" : ""}${isTruncated ? " (truncated)" : ""}`;

  return (
    <Box flexDirection="column">
      {shouldCollapse ? (
        <Collapsible title={displayTitle} open={false}>
          {filesContent}
        </Collapsible>
      ) : (
        <>
          <Text>{displayTitle}</Text>
          {filesContent}
        </>
      )}
    </Box>
  );
};
