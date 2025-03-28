import * as nodePath from "node:path";
import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";
import type { ToolInvocation as ToolInvocationAny } from "@ai-sdk/ui-utils";
import { ConfirmInput } from "@inkjs/ui";
import type {
  ApplyDiffInputType,
  ApplyDiffOutputType,
  AskFollowupQuestionInputType,
  AskFollowupQuestionOutputType,
  ListFilesInputType,
  ListFilesOutputType,
  ReadFileInputType,
  ReadFileOutputType,
  WriteToFileInputType,
  WriteToFileOutputType,
} from "@ragdoll/tools";
import Collapsible from "./collapsible";

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
  const children = (
    <>
      <C toolCall={toolCall} />
      {approval === "pending" && <ConfirmToolUsage confirm={approveTool} />}
      {toolCall.state === "result" &&
        typeof toolCall.result === "object" &&
        "error" in toolCall.result && (
          <ErrorResult error={toolCall.result.error} />
        )}
    </>
  );
  const boxProps = {
    flexDirection: "column",
    borderStyle: "round",
    borderColor: "grey",
    marginLeft: 1,
    padding: 1,
    gap: 1,
  } as const;

  return <Box {...boxProps}>{children}</Box>;
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
  const { path, diff, startLine, endLine } = toolCall.args;

  // Count the number of lines in the diff
  const lineCount = diff.split("\n").length;
  const shouldCollapse = lineCount > 5;

  // Create the line range string
  const lineRange = `[lines ${startLine}-${endLine}]`;

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Applying patch to</Text>
        <Text color="yellowBright">{path}</Text>
        <Text color="grey">{lineRange}</Text>
      </Box>
      {shouldCollapse ? (
        <Collapsible title={`Patch (${lineCount} lines)`} open={false}>
          <Text color="grey">{diff}</Text>
        </Collapsible>
      ) : (
        <Text color="grey">{diff}</Text>
      )}
    </Box>
  );
};

const TaskCompleteTool: React.FC<
  ToolProps<AttemptCompletionInputType, AttemptCompletionOutputType>
> = ({ toolCall }) => {
  const { result, command } = toolCall.args;
  return (
    <Box flexDirection="column" gap={1}>
      <Text color="greenBright">Task Complete</Text>
      <Markdown>{result}</Markdown>
      {command && <Text>Please run `{command}` to check the result.</Text>}
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
  const { path, startLine, endLine } = toolCall.args; // Extract startLine and endLine
  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { isTruncated } = toolCall.result;
      resultEl = (
        <Text>
          {toolCall.result.content.length} characters read
          {isTruncated ? ", truncated" : ""}
        </Text>
      );
    }
  }

  // Conditionally create the line range string
  const lineRange =
    startLine !== undefined || endLine !== undefined
      ? `[lines ${startLine ?? 1}-${endLine ?? "end"}]`
      : "";

  return (
    <Box gap={1} flexDirection="column">
      <Box gap={1}>
        <Text>Reading file</Text>
        <Text color="yellowBright">{path}</Text>
        {lineRange && <Text color="grey">{lineRange}</Text>}
      </Box>
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
  const isError =
    toolCall.state === "result" &&
    typeof toolCall.result === "object" &&
    "error" in toolCall.result;
  return (
    <>
      <ToolArgs name={toolCall.toolName} args={toolCall.args} />
      {toolCall.state === "result" && !isError && (
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

const WriteToFileTool: React.FC<
  ToolProps<WriteToFileInputType, WriteToFileOutputType>
> = ({ toolCall }) => {
  const { path, content } = toolCall.args;

  // Count the number of lines in the content
  const lineCount = content.split("\n").length;
  const contentLength = content.length;
  const shouldCollapse = lineCount > 5;

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Text>Writing to file</Text>
        <Text color="yellowBright">{path}</Text>
        <Text>
          ({contentLength} characters, {lineCount} lines)
        </Text>
      </Box>
      {shouldCollapse ? (
        <Collapsible title={`Content (${lineCount} lines)`} open={false}>
          <Text color="grey">{content}</Text>
        </Collapsible>
      ) : (
        <Text color="grey">{content}</Text>
      )}
    </Box>
  );
};

const ListFilesTool: React.FC<
  ToolProps<ListFilesInputType, ListFilesOutputType>
> = ({ toolCall }) => {
  const { path, recursive } = toolCall.args;

  let resultEl: React.ReactNode;
  if (toolCall.state === "result") {
    if (!("error" in toolCall.result)) {
      const { files, isTruncated } = toolCall.result;

      // Group files by directory for better visualization
      const filesByDir: Record<string, string[]> = {};
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dirPath = file.split("/").slice(0, -1).join("/") || ".";
        if (!filesByDir[dirPath]) {
          filesByDir[dirPath] = [];
        }
        filesByDir[dirPath].push(file.split("/").pop() || "");
      }

      const filesContent = (
        <Box flexDirection="column">
          {Object.entries(filesByDir).map(([dir, dirFiles], idx) => (
            <Box key={idx} flexDirection="column" marginLeft={1} marginTop={1}>
              <Text color="blueBright">{dir}/</Text>
              <Box flexDirection="column" marginLeft={2}>
                <Text color="yellowBright">{dirFiles.join(", ")}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      );

      // Determine if we should collapse the file list
      const shouldCollapse = Object.entries(filesByDir).length > 5;

      resultEl = (
        <Box flexDirection="column">
          <Text>
            Found {files.length} files{isTruncated ? " (truncated)" : ""}
          </Text>
          {shouldCollapse ? (
            <Collapsible title={`Files (${files.length})`} open={false}>
              {filesContent}
            </Collapsible>
          ) : (
            filesContent
          )}
        </Box>
      );
    }
  }

  const absolutePath = nodePath.join(process.cwd(), path);
  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Text>Listing files in </Text>
        <Text color="yellowBright">{absolutePath}</Text>
        {recursive && <Text> (recursive)</Text>}
      </Box>
      {resultEl}
    </Box>
  );
};

const ToolComponents: Record<string, React.FC<ToolProps>> = {
  applyDiff: ApplyDiffTool,
  attemptCompletion: TaskCompleteTool,
  askFollowupQuestion: AskFollowupQuestionTool,
  listFiles: ListFilesTool,
  readFile: ReadFileTool,
  writeToFile: WriteToFileTool,
};

export default ToolBox;
