import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";
import type { ToolInvocation as ToolInvocationAny } from "@ai-sdk/ui-utils";
import { ConfirmInput, TextInput } from "@inkjs/ui";
import type {
  ApplyDiffInputType,
  ApplyDiffOutputType,
  AskFollowupQuestionInputType,
  AskFollowupQuestionOutputType,
} from "@ragdoll/tools";
import type { ReadFileInputType, ReadFileOutputType } from "@ragdoll/tools";

import type {
  AttemptCompletionInputType,
  AttemptCompletionOutputType,
} from "@ragdoll/tools";

import { Box, Text } from "ink";
import Markdown from "./markdown";

type ToolInvocation<INPUT, OUTPUT> =
  | ({
      state: "partial-call";
      step?: number;
    } & ToolCall<string, INPUT>)
  | ({
      state: "call";
      step?: number;
    } & ToolCall<string, INPUT>)
  | ({
      state: "result";
      step?: number;
    } & ToolResult<string, INPUT, OUTPUT>);

export default function ToolBox({
  toolInvocation,
  confirmTool,
  submitAnswer,
}: {
  toolInvocation: ToolInvocationAny;
  confirmTool?: (approved: boolean) => void;
  submitAnswer?: (answer: string) => void;
}) {
  const components: Record<string, typeof DefaultTool> = {
    applyDiff: ApplyDiffTool,
    attemptCompletion: TaskCompleteTool,
    askFollowupQuestion: (props) => (
      <AskFollowupQuestionTool {...props} submitAnswer={submitAnswer} />
    ),
    readFile: ReadFileTool,
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

function ApplyDiffTool({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation<ApplyDiffInputType, ApplyDiffOutputType>;
}) {
  const { path, diff } = toolInvocation.args;
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Applying patch to </Text>
        <Text color="yellowBright">{path}</Text>
      </Box>
      <Text color="grey">{diff}</Text>
    </Box>
  );
}

function TaskCompleteTool({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation<
    AttemptCompletionInputType,
    AttemptCompletionOutputType
  >;
}) {
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
  toolInvocation: ToolInvocation<
    AskFollowupQuestionInputType,
    AskFollowupQuestionOutputType
  >;
  submitAnswer?: (answer: string) => void;
}) {
  const followUp = (toolInvocation.args.followUp || []).join(", ");
  const followUpPrompt = followUp ? `\nPossible follow-ups: ${followUp}` : "";
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

function ReadFileTool({
  toolInvocation,
}: {
  toolInvocation: ToolInvocation<ReadFileInputType, ReadFileOutputType>;
}) {
  const { path } = toolInvocation.args;
  return (
    <Box>
      <Text>Reading file </Text>
      <Text color="yellowBright">{path}</Text>
    </Box>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: args are dynamic
function ToolArgs({ name, args }: { name: string; args: any }) {
  return (
    <Box>
      <Text color="whiteBright">{name}( </Text>
      <Record value={args} />
      <Text color="whiteBright"> )</Text>
    </Box>
  );
}

function DefaultTool({
  toolInvocation,
}: { toolInvocation: ToolInvocationAny }) {
  return (
    <>
      <ToolArgs name={toolInvocation.toolName} args={toolInvocation.args} />
      {toolInvocation.state === "result" && toolInvocation.result && (
        <Box marginLeft={1}>
          <Record value={toolInvocation.result} flexDirection="column" />
        </Box>
      )}
    </>
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
