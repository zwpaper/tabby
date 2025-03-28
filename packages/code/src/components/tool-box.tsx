import * as nodePath from "node:path";
import type { ToolCall, ToolResult } from "@ai-sdk/provider-utils";
import { ConfirmInput } from "@inkjs/ui";
import type {
  ApplyDiffInputType,
  ApplyDiffOutputType,
  AskFollowupQuestionInputType,
  AskFollowupQuestionOutputType,
  ExecuteCommandInputType,
  ExecuteCommandOutputType,
  ListFilesInputType,
  ListFilesOutputType,
  ReadFileInputType,
  ReadFileOutputType,
  SearchFilesInputType,
  SearchFilesOutputType,
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

  const C = ToolComponents[toolCall.toolName];
  const children = (
    <>
      <C toolCall={toolCall} />
      {approval === "pending" && <ConfirmToolUsage confirm={approveTool} />}
      {toolCall.state === "result" &&
        typeof toolCall.result === "object" &&
        toolCall.result !== null && // Added null check for safety
        "error" in toolCall.result && (
          <ErrorResult error={(toolCall.result as { error: string }).error} /> // Type assertion
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

  let resultEl: React.ReactNode = undefined;
  if (
    toolCall.state === "result" &&
    typeof toolCall.result === "object" &&
    toolCall.result !== null && // Added null check
    !("error" in toolCall.result)
    // Assuming a successful result doesn't contain an 'error' key
  ) {
    resultEl = <Text color="greenBright">Patch applied successfully.</Text>;
  }

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
      {resultEl}
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

const ExecuteCommandTool: React.FC<
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

const SearchFilesTool: React.FC<
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

function ErrorResult({ error }: { error: string }) {
  return (
    <Box>
      <Text color="grey">error: </Text>
      <Text>{error}</Text>
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

  let resultEl: React.ReactNode;
  if (
    toolCall.state === "result" &&
    typeof toolCall.result === "object" &&
    toolCall.result !== null && // Added null check
    !("error" in toolCall.result)
  ) {
    resultEl = <Text color="greenBright">File written successfully.</Text>;
  }

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
      {resultEl}
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
  executeCommand: ExecuteCommandTool,
  listFiles: ListFilesTool,
  readFile: ReadFileTool,
  searchFiles: SearchFilesTool,
  writeToFile: WriteToFileTool,
};

export default ToolBox;
