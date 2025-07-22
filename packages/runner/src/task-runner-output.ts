import type { ClientToolsType, ToolFunctionType } from "@getpochi/tools";
import { formatters } from "@ragdoll/common";
import type { Tool, ToolCall, ToolResult, UIMessage } from "ai";
import chalk from "chalk";
import deepEqual from "fast-deep-equal";
import loading from "loading-cli";
import PrettyError from "pretty-error";

export class TaskRunnerOutputStream {
  private renderedMessages: UIMessage[] = [];
  private renderedToolCalls: ToolInvocation[] = [];
  private loading:
    | {
        indicator: loading.Loading;
        toolCall?: ToolInvocation | undefined;
      }
    | undefined = undefined;

  constructor(readonly stream: NodeJS.WriteStream) {}

  updateMessage(messages: UIMessage[]) {
    const formattedMessages = formatters.ui(messages);
    for (const message of formattedMessages) {
      if (message.role !== "user" && message.role !== "assistant") {
        continue; // Only render user and assistant messages
      }
      const renderedMessage = this.renderedMessages.find(
        (m) => m.id === message.id,
      );
      if (deepEqual(renderedMessage, message)) {
        continue; // Skip already rendered messages
      }

      // Count rendered parts
      let renderedPartsCount = 0;
      if (renderedMessage) {
        while (
          renderedPartsCount < renderedMessage.parts.length &&
          renderedPartsCount < message.parts.length
        ) {
          if (
            deepEqual(
              renderedMessage.parts[renderedPartsCount],
              message.parts[renderedPartsCount],
            )
          ) {
            renderedPartsCount++;
          } else {
            break; // Stop if parts do not match
          }
        }
      }

      // Render any new parts
      for (const part of message.parts.slice(renderedPartsCount)) {
        this.renderPart(part, message.role);
      }
    }
    this.renderedMessages = formattedMessages;
  }

  updateToolCall(toolCall: ToolInvocation) {
    this.renderToolCallPart(toolCall);
  }

  startLoading(label?: string) {
    const displayText = label || "Loading...";
    if (this.loading) {
      this.loading.indicator.text = displayText;
    } else {
      const indicator = this.createLoadingIndicator();
      indicator.start(displayText);
      this.loading = { indicator };
    }
  }

  succeedLoading(label?: string) {
    this.loading?.indicator.succeed(label);
    this.loading = undefined;
  }

  failLoading(label?: string) {
    this.loading?.indicator.fail(label);
    this.loading = undefined;
  }

  stopLoading() {
    this.loading?.indicator.stop();
    this.loading = undefined;
  }

  printText(text: string) {
    this.stream.write(text);
  }

  println(repeats = 1) {
    this.stream.write("\n".repeat(repeats));
  }

  printError(error: Error) {
    this.println();
    const pretty = new PrettyError().render(error);
    this.printText(pretty);
    this.println();
  }

  finish() {
    this.println();
    this.stream.write("\x1b[?25h"); // ANSI escape sequences to show cursor
  }

  private renderPart(
    part: UIMessage["parts"][number],
    role: "user" | "assistant",
  ) {
    switch (part.type) {
      case "text":
        this.renderTextPart(role, part.text);
        break;
      case "reasoning":
        this.renderReasoningPart(part.reasoning);
        break;
      case "tool-invocation":
        {
          if (part.toolInvocation.state === "partial-call") {
            // Skip rendering for partial calls
            return;
          }
          if (
            this.renderedToolCalls.find(
              (call) => call.toolCallId === part.toolInvocation.toolCallId,
            )
          ) {
            // Skip rendering for already rendered tool calls
            return;
          }
          this.renderedToolCalls.push(part.toolInvocation);

          if (part.toolInvocation.toolName in StaticToolRenderers) {
            // Tool calls not handled by the runner, render directly with the static renderer
            this.renderToolCallPart(part.toolInvocation);
          } else if (part.toolInvocation.toolName in RunnerToolRenderers) {
            // Tool calls handled by the runner
            if (part.toolInvocation.state === "result") {
              // Render the finished tool call
              this.renderToolCallPart(part.toolInvocation);
            } else {
              // Ignore all `call` state tool calls,
              // they should be rendered by invoking `updateToolCall`
            }
          } else {
            this.renderRawJson(JSON.stringify(part.toolInvocation, null, 2));
          }
        }
        break;
      default:
        // not support other types
        break;
    }
  }

  private renderTextPart(role: "user" | "assistant", text: string) {
    this.stopLoading();
    const roleName =
      role === "assistant"
        ? chalk.bold(chalk.blue("🤖 Pochi"))
        : chalk.bold(chalk.green("👤 You"));
    this.printText(`\n${roleName}: ${text}`);
    this.println();
  }

  private renderReasoningPart(_reasoning: string) {
    this.stopLoading();
    this.printText(
      chalk.dim("💭 ") + chalk.italic(chalk.dim("Pochi is thinking...")),
    );
    this.println();
  }

  private renderToolCallPart(toolCall: ToolInvocation) {
    const renderers = { ...StaticToolRenderers, ...RunnerToolRenderers };
    const renderer = renderers[toolCall.toolName];
    if (!renderer) {
      return;
    }

    let current: loading.Loading | undefined = undefined;
    if (this.loading) {
      if (this.loading.toolCall?.toolCallId === toolCall.toolCallId) {
        // If the current loading indicator is for this tool call, reuse it
        current = this.loading.indicator;
      } else {
        // Otherwise, stop the current loading indicator
        this.stopLoading();
      }
    }

    const rendered = renderer(toolCall, () => {
      return current || this.createLoadingIndicator();
    });
    if (typeof rendered === "string") {
      this.printText(rendered);
      this.println();
    } else if (rendered) {
      this.loading = { indicator: rendered, toolCall };
    } else {
      this.loading = undefined;
    }
  }

  private renderRawJson(json: string) {
    this.stopLoading();
    this.printText(json);
    this.println();
  }

  private createLoadingIndicator() {
    return loading({
      frames: LoadingFrames,
      stream: this.stream,
      interval: LoadingFramesInterval,
    });
  }
}

// biome-ignore lint/suspicious/noExplicitAny: used for type inference
type ToolInvocation<INPUT = any, OUTPUT = any> =
  | ({
      state: "call";
    } & ToolCall<string, INPUT>)
  | ({
      state: "result";
    } & ToolResult<string, INPUT, OUTPUT>);

type ToolProps<T extends Tool> = ToolInvocation<
  Parameters<ToolFunctionType<T>>[0],
  Awaited<ReturnType<ToolFunctionType<T>>> | { error: string }
>;

// Renderer returns:
// - string: Static text to render
// - loading.Loading: A loading indicator in progress
// - undefined: Nothing to render, or the current loading indicator has been finalized

type ToolRenderer<T extends Tool> = (
  tool: ToolProps<T>,
  // Get the current loading indicator or create a new one
  loading: () => loading.Loading,
) => string | loading.Loading | undefined;

const StaticToolRenderers: Record<string, ToolRenderer<Tool> | undefined> = {
  attemptCompletion: (
    toolCall: ToolProps<ClientToolsType["attemptCompletion"]>,
  ) => {
    const { result } = toolCall.args || {};
    return `\n${chalk.bold(chalk.green("🎉 Task Completed"))}\n${chalk.dim("└─")} ${result}\n`;
  },
  askFollowupQuestion: (
    toolCall: ToolProps<ClientToolsType["askFollowupQuestion"]>,
  ) => {
    const { question, followUp } = toolCall.args || {};
    return `\n${chalk.bold(chalk.yellow(`❓ ${question}`))}\n${followUp.map((option, i) => `${chalk.dim(`   ${i + 1}.`)} ${option}`).join("\n")}\n`;
  },
  // biome-ignore lint/suspicious/noExplicitAny: ToolProps<ServerToolsType["webFetch"]>
  webFetch: (toolCall: any) => {
    const { url } = toolCall.args || {};
    if (!url) return `${Icon.done} Web fetch completed`;
    try {
      const domain = new URL(url).hostname;
      // Check if this is an error result
      if (toolCall.result && "error" in toolCall.result) {
        return `${Icon.error} Failed to fetch ${chalk.blue(domain)} ${ErrorLabel} ${toolCall.result.error}`;
      }

      // Check if content was truncated (based on server implementation)
      const isTruncated = toolCall.result?.isTruncated;
      const truncatedNote = isTruncated
        ? chalk.dim(" (content truncated)")
        : "";

      return `${Icon.done} Fetched content from ${chalk.blue(domain)}${truncatedNote} ${chalk.dim(`(${url})`)}`;
    } catch (error) {
      return `${Icon.error} Invalid URL: ${chalk.dim(url)}`;
    }
  },
  todoWrite: undefined,
  newTask: undefined,
};

const RunnerToolRenderers: Record<string, ToolRenderer<Tool> | undefined> = {
  readFile: (
    toolCall: ToolProps<ClientToolsType["readFile"]>,
    loading: () => loading.Loading,
  ) => {
    const { path, startLine, endLine } = toolCall.args || {};
    const pathString = styledPathString(
      `${path}${startLine !== undefined && endLine !== undefined ? `:${startLine}-${endLine}` : ""}`,
      "read",
    );
    if (toolCall.state === "call") {
      return loading().start(`Reading ${pathString}`);
    }
    if (!("error" in toolCall.result)) {
      loading().succeed(`Read ${pathString}`);
    } else {
      loading().fail(
        `Read ${pathString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  writeToFile: (
    toolCall: ToolProps<ClientToolsType["writeToFile"]>,
    loading: () => loading.Loading,
  ) => {
    const { path } = toolCall.args || {};
    const pathString = styledPathString(path, "write");
    if (toolCall.state === "call") {
      return loading().start(`Writing ${pathString}`);
    }
    if (!("error" in toolCall.result)) {
      loading().succeed(`Wrote ${pathString}`);
    } else {
      loading().fail(
        `Write ${pathString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  applyDiff: (
    toolCall: ToolProps<ClientToolsType["applyDiff"]>,
    loading: () => loading.Loading,
  ) => {
    const {
      path,
      searchContent,
      replaceContent,
      expectedReplacements = 1,
    } = toolCall.args || {};
    const pathString = styledPathString(path);
    const countLines = (content: string) => {
      return content.split("\n").length;
    };
    const deletedLines = countLines(searchContent) * expectedReplacements;
    const addedLines = countLines(replaceContent) * expectedReplacements;
    const diff =
      addedLines > 0 || deletedLines > 0
        ? `${chalk.dim("(")}${chalk.green(`+${addedLines}`)}${chalk.dim("/")}${chalk.red(`-${deletedLines}`)}${chalk.dim(")")}`
        : "";
    if (toolCall.state === "call") {
      return loading().start(
        `Applying diff to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    }
    if (!("error" in toolCall.result)) {
      loading().succeed(
        `Applied diff to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    } else {
      loading().fail(
        `Apply diff to ${pathString}${diff ? ` ${diff}` : ""} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  multiApplyDiff: (
    toolCall: ToolProps<ClientToolsType["multiApplyDiff"]>,
    loading: () => loading.Loading,
  ) => {
    const { path, edits } = toolCall.args || {};
    const pathString = styledPathString(path);
    const countDeletedLines = (edit: {
      searchContent: string;
      replaceContent: string;
      expectedReplacements?: number | undefined;
    }) => {
      return (
        edit.searchContent.split("\n").length * (edit.expectedReplacements || 1)
      );
    };
    const countAddedLines = (edit: {
      searchContent: string;
      replaceContent: string;
      expectedReplacements?: number | undefined;
    }) => {
      return (
        edit.replaceContent.split("\n").length *
        (edit.expectedReplacements || 1)
      );
    };
    const deletedLines = edits.reduce(
      (acc, edit) => acc + countDeletedLines(edit),
      0,
    );
    const addedLines = edits.reduce(
      (acc, edit) => acc + countAddedLines(edit),
      0,
    );
    const diff =
      addedLines > 0 || deletedLines > 0
        ? `${chalk.dim("(")}${chalk.green(`+${addedLines}`)}${chalk.dim("/")}${chalk.red(`-${deletedLines}`)}${chalk.dim(")")}`
        : "";
    const editCount = `${chalk.dim("(")}${edits.length} edit${edits.length !== 1 ? "s" : ""}${chalk.dim(")")}`;
    if (toolCall.state === "call") {
      return loading().start(
        `Applying ${editCount} to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    }
    if (!("error" in toolCall.result)) {
      loading().succeed(
        `Applied ${editCount} to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    } else {
      loading().fail(
        `Apply ${editCount} to ${pathString}${diff ? ` ${diff}` : ""} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  executeCommand: (
    toolCall: ToolProps<ClientToolsType["executeCommand"]>,
    loading: () => loading.Loading,
  ) => {
    const { command, cwd } = toolCall.args || {};
    const cwdString = cwd ? chalk.dim(` in ${cwd}`) : "";
    let renderedCommand = command.replace(/\r\n|\r|\n/g, " "); // no multiline
    if (renderedCommand.length > 60) {
      renderedCommand = `${renderedCommand.slice(0, 50)}...${chalk.dim(`(+${renderedCommand.length - 50})`)}`;
    }
    if (toolCall.state === "call") {
      return loading().start(
        `Running ${chalk.cyan(renderedCommand)}${cwdString}`,
      );
    }
    if (!("error" in toolCall.result)) {
      loading().succeed(`Ran ${chalk.cyan(renderedCommand)}${cwdString}`);
    } else {
      loading().fail(
        `Run ${chalk.cyan(renderedCommand)}${cwdString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  searchFiles: (
    toolCall: ToolProps<ClientToolsType["searchFiles"]>,
    loading: () => loading.Loading,
  ) => {
    const { regex, path } = toolCall.args || {};
    const pathString = styledPathString(path);
    const regexString = chalk.magenta(regex);
    if (toolCall.state === "call") {
      return loading().start(`Searching ${regexString} in ${pathString}`);
    }
    if (!("error" in toolCall.result)) {
      const matchCount = toolCall.result.matches?.length || 0;
      const matchText = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
      const truncated = toolCall.result.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Found ${chalk.yellow(matchText)} for ${regexString} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `Search ${regexString} in ${pathString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  listFiles: (
    toolCall: ToolProps<ClientToolsType["listFiles"]>,
    loading: () => loading.Loading,
  ) => {
    const { path } = toolCall.args || {};
    const pathString = styledPathString(path);
    if (toolCall.state === "call") {
      return loading().start(`Listing ${pathString}`);
    }
    if (!("error" in toolCall.result)) {
      const fileCount = toolCall.result.files?.length || 0;
      const fileText = `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
      const truncated = toolCall.result.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Listed ${chalk.yellow(fileText)} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `List ${pathString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
  globFiles: (
    toolCall: ToolProps<ClientToolsType["globFiles"]>,
    loading: () => loading.Loading,
  ) => {
    const { globPattern, path } = toolCall.args || {};
    const pathString = styledPathString(path);
    const globPatternString = chalk.magenta(globPattern);
    if (toolCall.state === "call") {
      return loading().start(`Globbing ${globPatternString} in ${pathString}`);
    }
    if (!("error" in toolCall.result)) {
      const matchCount = toolCall.result.files?.length || 0;
      const matchText = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
      const truncated = toolCall.result.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Found ${chalk.yellow(matchText)} for ${globPatternString} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `Glob ${globPatternString} in ${pathString} ${ErrorLabel} ${toolCall.result.error}`,
      );
    }
    return undefined;
  },
};

const styledPathString = (path: string, operation?: "read" | "write") => {
  const baseStyle = chalk.italic(path);
  if (operation === "read") {
    return chalk.blue(baseStyle);
  }
  if (operation === "write") {
    return chalk.green(baseStyle);
  }
  return baseStyle;
};
const ErrorLabel = chalk.bold(chalk.red("ERROR:"));
const Icon = {
  done: chalk.green("✔"),
  error: chalk.red("✖"),
};
const LoadingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const LoadingFramesInterval = 100; // ms
