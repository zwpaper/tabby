import type {
  ExecuteCommandInputType,
  ExecuteCommandOutputType,
} from "@ragdoll/tools";
import { Box, Text } from "ink";

const renderOutput = (
  output: string | undefined,
  title: string,
  color: string,
): React.ReactNode => {
  if (!output) return null;

  const outputLines = output.trim().split("\n");
  const shouldCollapse = outputLines.length > 5;

  return shouldCollapse ? (
    <Collapsible title={`${title} (${outputLines.length} lines)`} open={false}>
      <Text color={color}>{output}</Text>
    </Collapsible>
  ) : (
    <Box flexDirection="column" gap={1}>
      <Text color="grey">{title}</Text>
      <Text color={color}>{output}</Text>
    </Box>
  );
};
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const ExecuteCommandTool: React.FC<
  ToolProps<ExecuteCommandInputType, ExecuteCommandOutputType>
> = ({ toolCall }) => {
  const { command, cwd } = toolCall.args;
  let resultEl: React.ReactNode;

  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { stdout, stderr } = toolCall.result;

      resultEl = (
        <Box flexDirection="column" gap={1}>
          {renderOutput(stdout, "Stdout", "grey")}
          {renderOutput(stderr, "Stderr", "grey")}
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
