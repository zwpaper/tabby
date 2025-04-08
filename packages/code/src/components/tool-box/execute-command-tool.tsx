import { Box, Text } from "ink";

const renderOutput = (
  output: string | undefined,
  title: string,
  color: string,
): React.ReactNode => {
  if (!output) return null;
  const x = output.trim();
  if (!x) return null;

  const outputLines = x.split("\n");
  const shouldCollapse = outputLines.length > 5;

  return shouldCollapse ? (
    <Collapsible
      key={title}
      title={`${title} (${outputLines.length} lines)`}
      open={false}
    >
      <Text color={color}>{x}</Text>
    </Collapsible>
  ) : (
    <Box key={title} flexDirection="column" gap={1}>
      <Text color={color}>{x}</Text>
    </Box>
  );
};
import type { ExecuteCommandFunctionType } from "@ragdoll/tools";
import Collapsible from "../collapsible";
import type { ToolProps } from "./types";

export const ExecuteCommandTool: React.FC<
  ToolProps<ExecuteCommandFunctionType>
> = ({ toolCall }) => {
  const { command = "", cwd = undefined } = toolCall.args || {};
  let resultEl: React.ReactNode;

  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { output } = toolCall.result;
      const children = [renderOutput(output, "Output", "grey")].filter(Boolean);
      resultEl = children.length > 0 && (
        <Box flexDirection="column" gap={1}>
          {children}
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
