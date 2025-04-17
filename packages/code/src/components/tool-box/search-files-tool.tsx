import type { SearchFilesFunctionType } from "@ragdoll/tools";
import { Box, Text } from "ink";
import type { ToolProps } from "./types";

export const SearchFilesTool: React.FC<ToolProps<SearchFilesFunctionType>> = ({
  toolCall,
}) => {
  const {
    path = "",
    regex = "",
    filePattern = undefined,
  } = toolCall.args || {};
  let resultEl: React.ReactNode;

  if (toolCall.state === "result") {
    // Check if the result is an object and not an error
    if (
      typeof toolCall.result === "object" &&
      toolCall.result !== null &&
      !("error" in toolCall.result)
    ) {
      // Correctly destructure the matches array
      const { matches } = toolCall.result;
      const matchCount = matches.length;

      // Display only up to 5 matches, then show a summary message for the rest
      const visibleMatches = matches.slice(0, 5);
      const hiddenMatchCount = matches.length > 5 ? matches.length - 5 : 0;

      resultEl = (
        <Box flexDirection="column" gap={1}>
          <Text>Found {matchCount} matches</Text>
          {matchCount > 0 && (
            <Box flexDirection="column" gap={1}>
              {visibleMatches.map((match, index) => (
                <Box key={index} flexDirection="column" paddingX={1}>
                  <Box gap={1}>
                    <Text color="yellowBright">{match.file}</Text>
                    <Text color="grey">[line {match.line}]</Text>
                  </Box>
                  <Text color="grey">{match.context}</Text>
                </Box>
              ))}
              {hiddenMatchCount > 0 && (
                <Box marginTop={1}>
                  <Text color="gray" dimColor>
                    ... ( {hiddenMatchCount} more match
                    {hiddenMatchCount === 1 ? "" : "es"} )
                  </Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      );
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Searching in</Text>
        <Text color="yellowBright">{path}</Text>
        <Text>for</Text>
        <Text color="magentaBright">{regex}</Text>
        {filePattern && (
          <>
            <Text>matching</Text>
            <Text color="cyanBright">{filePattern}</Text>
          </>
        )}
      </Box>
      {resultEl}
    </Box>
  );
};
