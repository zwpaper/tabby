import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";
import type { ToolInvocation as ToolInvocationAny } from "@ai-sdk/ui-utils";
import { ConfirmInput } from "@inkjs/ui";
import type {
  ApplyDiffInputType,
  ApplyDiffOutputType,
  AskFollowupQuestionInputType,
  AskFollowupQuestionOutputType,
} from "@ragdoll/tools";
import type { ReadFileInputType, ReadFileOutputType } from "@ragdoll/tools";

import { useExecuteTool } from "@/tools";
import type {
  AttemptCompletionInputType,
  AttemptCompletionOutputType,
} from "@ragdoll/tools";
import { Box, Text, useFocus } from "ink";
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

// biome-ignore lint/suspicious/noExplicitAny: external function def.
interface ToolProps<INPUT = any, OUTPUT = any> {
  toolCall: ToolInvocation<INPUT, OUTPUT>;
}

const ToolBox: React.FC<
  ToolProps & {
    addToolResult: (args: { toolCallId: string; result: unknown }) => void;
  }
> = ({ toolCall, addToolResult }) => {
  const { approval, approveTool } = useExecuteTool({
    toolCall,
    addToolResult,
  });

  const C = ToolComponents[toolCall.toolName] || DefaultTool;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="grey"
      marginLeft={1}
      padding={1}
      gap={1}
    >
      <C toolCall={toolCall} />
      {approval === "pending" && <ConfirmToolUsage confirm={approveTool} />}
      {toolCall.state === "result" && "error" in toolCall.result && (
        <ErrorResult error={toolCall.result.error} />
      )}
    </Box>
  );
};

function ConfirmToolUsage({
  confirm,
}: { confirm: (approved: boolean) => void }) {
  const { isFocused } = useFocus({ autoFocus: true });

  return (
    <Box gap={1}>
      <Text color="whiteBright" underline={isFocused}>
        Allow this tool to run?
      </Text>
      <ConfirmInput
        isDisabled={!isFocused}
        onConfirm={() => confirm(true)}
        onCancel={() => confirm(false)}
      />
    </Box>
  );
}

const ApplyDiffTool: React.FC<
  ToolProps<ApplyDiffInputType, ApplyDiffOutputType>
> = ({ toolCall }) => {
  const { path, diff } = toolCall.args;
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Applying patch to </Text>
        <Text color="yellowBright">{path}</Text>
      </Box>
      <Text color="grey">{diff}</Text>
    </Box>
  );
};

const TaskCompleteTool: React.FC<
  ToolProps<AttemptCompletionInputType, AttemptCompletionOutputType>
> = ({ toolCall }) => {
  const { result, command } = toolCall.args;
  return (
    <Box flexDirection="column">
      <Text color="greenBright">Task Complete</Text>
      <Markdown>{result}</Markdown>
      {command && <Text>Please use `{command}` to check the result.</Text>}
    </Box>
  );
};

const AskFollowupQuestionTool: React.FC<
  ToolProps<AskFollowupQuestionInputType, AskFollowupQuestionOutputType>
> = ({ toolCall }) => {
  const followUp = (toolCall.args.followUp || []).join(", ");
  const followUpPrompt = followUp ? `\nPossible follow-ups: ${followUp}` : "";
  const content = `${toolCall.args.question}${followUpPrompt}`;

  return (
    <Box flexDirection="column" gap={1}>
      <Text color="grey">Q: {content}</Text>
    </Box>
  );
};

const ReadFileTool: React.FC<
  ToolProps<ReadFileInputType, ReadFileOutputType>
> = ({ toolCall }) => {
  const { path } = toolCall.args;
  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { isTruncated } = toolCall.result;
      resultEl = (
        <Text>
          {" "}
          ({toolCall.result.content.length} characters read
          {isTruncated ? ", truncated" : ""})
        </Text>
      );
    }
  }
  return (
    <Box>
      <Text>Reading file </Text>
      <Text color="yellowBright">{path}</Text>
      {resultEl}
    </Box>
  );
};

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

function ErrorResult({ error }: { error: string }) {
  return (
    <Box>
      <Text color="grey">error: </Text>
      <Text>{error}</Text>
    </Box>
  );
}

function DefaultTool({ toolCall }: { toolCall: ToolInvocationAny }) {
  return (
    <>
      <ToolArgs name={toolCall.toolName} args={toolCall.args} />
      {toolCall.state === "result" && !("error" in toolCall.result) && (
        <Box marginLeft={1}>
          <Record value={toolCall.result} flexDirection="column" />
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

const ToolComponents: Record<string, React.FC<ToolProps>> = {
  applyDiff: ApplyDiffTool,
  attemptCompletion: TaskCompleteTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  readFile: ReadFileTool,
};

export default ToolBox;
