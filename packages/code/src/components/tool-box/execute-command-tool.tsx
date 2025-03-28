import type {
  ExecuteCommandInputType,
  ExecuteCommandOutputType,
} from "@ragdoll/tools";
import { Box, Text } from "ink";
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const ExecuteCommandTool: React.FC<
  ToolProps<ExecuteCommandInputType, ExecuteCommandOutputType>
> = ({ toolCall }) => {
  const { command, cwd } = toolCall.args;
  let resultEl: React.ReactNode;

  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      let { output } = toolCall.result;
      output = output.trim();
      const outputLines = output?.split("\n") || [];
      const shouldCollapse = outputLines.length > 5;

      resultEl = (
        <Box flexDirection="column" gap={1}>
          {shouldCollapse ? (
            <Collapsible
              title={`Output (${outputLines.length} lines)`}
              open={false}
            >
              <Text color="grey">{output}</Text>
            </Collapsible>
          ) : (
            <Text color="grey">{output}</Text>
          )}
        </Box>
      );
    }
  }

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Executing command</Text>
        <Text color="yellowBright">{command}</Text>
        {cwd && (
          <>
            <Text>in</Text>
            <Text color="blueBright">{cwd}</Text>
          </>
        )}
      </Box>
      {resultEl}
    </Box>
  );
};
