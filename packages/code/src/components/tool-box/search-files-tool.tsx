import type {
  SearchFilesInputType,
  SearchFilesOutputType,
} from "@ragdoll/tools";
import { Box, Text } from "ink";
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const SearchFilesTool: React.FC<
  ToolProps<SearchFilesInputType, SearchFilesOutputType>
> = ({ toolCall }) => {
  const { path, regex, filePattern } = toolCall.args;
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
      const shouldCollapse = matchCount > 5;

      const resultsContent = (
        <Box flexDirection="column" gap={1}>
          {matches.map((match, index) => (
            <Box key={index} flexDirection="column" paddingX={1}>
              <Box gap={1}>
                <Text color="yellowBright">{match.file}</Text>
                <Text color="grey">[line {match.line}]</Text>
              </Box>
              <Text color="grey">{match.context}</Text>
            </Box>
          ))}
        </Box>
      );

      resultEl = (
        <Box flexDirection="column" gap={1}>
          {!shouldCollapse && <Text>Found {matchCount} matches</Text>}
          {matchCount > 0 &&
            (shouldCollapse ? (
              <Collapsible title={`Found ${matchCount} matches`} open={false}>
                {resultsContent}
              </Collapsible>
            ) : (
              resultsContent
            ))}
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
        <Text color="magentaBright">/{regex}/</Text>
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
