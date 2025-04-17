import * as nodePath from "node:path";
import { Box, Text } from "ink";

interface FileListProps {
  files: string[];
  basePath?: string; // Optional base path to make file paths relative if needed
  title?: string;
  isTruncated?: boolean;
  maxDirectories?: number; // Number of directories to show before truncating
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
  maxDirectories = 5,
}) => {
  if (!files || files.length === 0) {
    return <Text>No files found.</Text>;
  }

  const filesByDir = groupFilesByDirectory(files, basePath);
  const directories = Object.entries(filesByDir);
  const displayTitle =
    title ||
    `Found ${files.length} file${files.length !== 1 ? "s" : ""}${isTruncated ? " (truncated)" : ""}`;

  // If we have more directories than the threshold, show only the first maxDirectories
  const visibleDirectories = directories.slice(0, maxDirectories);
  const hiddenDirectories =
    directories.length > maxDirectories
      ? directories.length - maxDirectories
      : 0;

  return (
    <Box flexDirection="column">
      <Text>{displayTitle}</Text>
      <Box flexDirection="column">
        {visibleDirectories.map(([dir, dirFiles], idx) => (
          <Box key={idx} flexDirection="column" marginLeft={1} marginTop={1}>
            <Text color="blueBright">{dir}/</Text>
            <Box flexDirection="column" marginLeft={2}>
              <Text color="yellowBright">{dirFiles.join(", ")}</Text>
            </Box>
          </Box>
        ))}
        {hiddenDirectories > 0 && (
          <Box marginLeft={1} marginTop={1}>
            <Text color="gray" dimColor>
              ... ( {hiddenDirectories} more director
              {hiddenDirectories === 1 ? "y" : "ies"} )
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
