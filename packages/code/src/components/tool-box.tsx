import type { ToolInvocation } from "@ai-sdk/ui-utils";
import { ConfirmInput, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import Markdown from "./markdown";

export default function ToolBox({
  toolInvocation,
  confirmTool,
  submitAnswer,
}: {
  toolInvocation: ToolInvocation;
  confirmTool?: (approved: boolean) => void;
  submitAnswer?: (answer: string) => void;
}) {
  const components: Record<string, typeof DefaultTool> = {
    attemptCompletion: TaskCompleteTool,
    askFollowupQuestion: (props) => (
      <AskFollowupQuestionTool {...props} submitAnswer={submitAnswer} />
    ),
  };

  const C = components[toolInvocation.toolName] || DefaultTool;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="grey"
      marginLeft={1}
      padding={1}
      gap={1}
    >
      <C toolInvocation={toolInvocation} />
      {confirmTool && <ConfirmToolUsage confirm={confirmTool} />}
    </Box>
  );
}

function ConfirmToolUsage({
  confirm,
}: { confirm: (approved: boolean) => void }) {
  return (
    <Box>
      <Text color="whiteBright">Allow this tool to run? </Text>
      <ConfirmInput
        onConfirm={() => confirm(true)}
        onCancel={() => confirm(false)}
      />
    </Box>
  );
}

function DefaultTool({ toolInvocation }: { toolInvocation: ToolInvocation }) {
  return (
    <>
      <ToolCall name={toolInvocation.toolName} args={toolInvocation.args} />
      {toolInvocation.state === "result" && toolInvocation.result && (
        <Box marginLeft={1}>
          <Record value={toolInvocation.result} flexDirection="column" />
        </Box>
      )}
    </>
  );
}

function TaskCompleteTool({
  toolInvocation,
}: { toolInvocation: ToolInvocation }) {
  const { result, command } = toolInvocation.args;
  return (
    <Box flexDirection="column">
      <Text color="greenBright">Task Complete</Text>
      <Markdown>{result}</Markdown>
      {command && <Text>Please use `{command}` to check the result.</Text>}
    </Box>
  );
}

function AskFollowupQuestionTool({
  toolInvocation,
  submitAnswer,
}: {
  toolInvocation: ToolInvocation;
  submitAnswer?: (answer: string) => void;
}) {
  const followUps = (toolInvocation.args.followUps || []).join(", ");
  const followUpPrompt = followUps ? `\nPossible follow-ups: ${followUps}` : "";
  const content = `${toolInvocation.args.question}${followUpPrompt}`;
  return (
    <Box flexDirection="column" gap={1}>
      <Text color="grey">Q: {content}</Text>
      <Box>
        <Text color="grey">A: </Text>
        {toolInvocation.state === "result" && (
          <Text color="grey">{toolInvocation.result}</Text>
        )}
        {toolInvocation.state === "call" && (
          <TextInput
            onSubmit={submitAnswer}
            placeholder="Type your answer here..."
          />
        )}
      </Box>
    </Box>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: args are dynamic
function ToolCall({ name, args }: { name: string; args: any }) {
  return (
    <Box>
      <Text color="whiteBright">{name}( </Text>
      <Record value={args} />
      <Text color="whiteBright"> )</Text>
    </Box>
  );
}

function Record({
  value,
  flexDirection,
}: {
  value: Record<string, unknown> | Array<unknown>;
  flexDirection?: "row" | "column";
}) {
  if (!Array.isArray(value)) {
    return (
      <Box gap={1} flexDirection={flexDirection}>
        {Object.entries(value).map(([key, value]) => (
          <Box key={key} gap={1}>
            <Text color="grey">{key}:</Text>
            <Text color="whiteBright">{JSON.stringify(value)}</Text>
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box gap={1} flexDirection={flexDirection}>
      {value.map((item, index) => (
        <Box key={index} gap={1}>
          <Text color="grey">{index}:</Text>
          <Text color="whiteBright">{JSON.stringify(item)}</Text>
        </Box>
      ))}
    </Box>
  );
}
