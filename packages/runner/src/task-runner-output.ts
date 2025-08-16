import { type ToolUIPart, getToolName, isToolUIPart } from "@ai-v5-sdk/ai";
import { formatters } from "@getpochi/common";
import type { Message, UITools } from "@getpochi/livekit";
import chalk from "chalk";
import deepEqual from "fast-deep-equal";
import loading from "loading-cli";
import PrettyError from "pretty-error";

export class TaskRunnerOutputStream {
  private renderedMessages: Message[] = [];
  private renderedToolCalls: ToolUIPart<UITools>[] = [];
  private loading:
    | {
        indicator: loading.Loading;
        toolCall?: ToolUIPart<UITools> | undefined;
      }
    | undefined = undefined;

  constructor(readonly stream: NodeJS.WriteStream) {}

  updateMessage(messages: Message[]) {
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

  updateToolCall(toolCall: ToolUIPart<UITools>) {
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
    part: Message["parts"][number],
    role: "user" | "assistant",
  ) {
    switch (part.type) {
      case "text":
        this.renderTextPart(role, part.text);
        return;
      case "reasoning":
        this.renderReasoningPart(part.text);
        return;
    }

    if (!isToolUIPart(part)) {
      // Not support other parts.
      return;
    }
    if (part.state === "input-streaming") {
      // Skip rendering for partial calls
      return;
    }
    if (
      this.renderedToolCalls.find((call) => call.toolCallId === part.toolCallId)
    ) {
      // Skip rendering for already rendered tool calls
      return;
    }
    this.renderedToolCalls.push(part);

    const toolName = getToolName(part);
    if (toolName in StaticToolRenderers) {
      // Tool calls not handled by the runner, render directly with the static renderer
      this.renderToolCallPart(part);
    } else if (toolName in RunnerToolRenderers) {
      // Tool calls handled by the runner
      if (part.state === "output-available") {
        // Render the finished tool call
        this.renderToolCallPart(part);
      } else {
        // Ignore all `call` state tool calls,
        // they should be rendered by invoking `updateToolCall`
      }
    } else {
      this.renderRawJson(JSON.stringify(part, null, 2));
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

  private renderToolCallPart(toolCall: ToolUIPart<UITools>) {
    const toolName = getToolName(toolCall);
    const renderers = { ...StaticToolRenderers, ...RunnerToolRenderers };
    const renderer = renderers[toolName];
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

    // @ts-expect-error cast to any
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

// Renderer returns:
// - string: Static text to render
// - loading.Loading: A loading indicator in progress
// - undefined: Nothing to render, or the current loading indicator has been finalized

type ToolProps<T extends string> = Exclude<
  Extract<ToolUIPart<UITools>, { type: `tool-${T}` }>,
  { state: "input-streaming" }
>;

type ToolRenderer<T extends string> = (
  toolCall: ToolProps<T>,
  // Get the current loading indicator or create a new one
  loading: () => loading.Loading,
) => string | loading.Loading | undefined;

const StaticToolRenderers = {
  attemptCompletion: (toolCall: ToolProps<"attemptCompletion">) => {
    const { result } = toolCall.input || {};
    return `\n${chalk.bold(chalk.green("🎉 Task Completed"))}\n${chalk.dim("└─")} ${result}\n`;
  },
  askFollowupQuestion: (toolCall: ToolProps<"askFollowupQuestion">) => {
    const { question, followUp } = toolCall.input || {};
    return `\n${chalk.bold(chalk.yellow(`❓ ${question}`))}\n${followUp?.map((option, i) => `${chalk.dim(`   ${i + 1}.`)} ${option}`).join("\n")}\n`;
  },
  todoWrite: undefined,
  newTask: undefined,
  // biome-ignore lint/suspicious/noExplicitAny: dynamic type
} as Record<string, ToolRenderer<any> | undefined>;

const RunnerToolRenderers = {
  readFile: (
    toolCall: ToolProps<"readFile">,
    loading: () => loading.Loading,
  ) => {
    const { path, startLine, endLine } = toolCall.input || {};
    const pathString = styledPathString(
      `${path}${startLine !== undefined && endLine !== undefined ? `:${startLine}-${endLine}` : ""}`,
      "read",
    );
    if (toolCall.state === "input-available") {
      return loading().start(`Reading ${pathString}`);
    }
    if (!toolCall.output) return;
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      loading().succeed(`Read ${pathString}`);
    } else {
      loading().fail(
        `Read ${pathString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  writeToFile: (
    toolCall: ToolProps<"writeToFile">,
    loading: () => loading.Loading,
  ) => {
    const { path } = toolCall.input || {};
    const pathString = styledPathString(path, "write");
    if (toolCall.state === "input-available") {
      return loading().start(`Writing ${pathString}`);
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      loading().succeed(`Wrote ${pathString}`);
    } else {
      loading().fail(
        `Write ${pathString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  applyDiff: (
    toolCall: ToolProps<"applyDiff">,
    loading: () => loading.Loading,
  ) => {
    const {
      path,
      searchContent,
      replaceContent,
      expectedReplacements = 1,
    } = toolCall.input || {};
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
    if (toolCall.state === "input-available") {
      return loading().start(
        `Applying diff to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      loading().succeed(
        `Applied diff to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    } else {
      loading().fail(
        `Apply diff to ${pathString}${diff ? ` ${diff}` : ""} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  multiApplyDiff: (
    toolCall: ToolProps<"multiApplyDiff">,
    loading: () => loading.Loading,
  ) => {
    const { path, edits } = toolCall.input || {};
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
    if (toolCall.state === "input-available") {
      return loading().start(
        `Applying ${editCount} to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      loading().succeed(
        `Applied ${editCount} to ${pathString}${diff ? ` ${diff}` : ""}`,
      );
    } else {
      loading().fail(
        `Apply ${editCount} to ${pathString}${diff ? ` ${diff}` : ""} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  executeCommand: (
    toolCall: ToolProps<"executeCommand">,
    loading: () => loading.Loading,
  ) => {
    const { command, cwd } = toolCall.input || {};
    const cwdString = cwd ? chalk.dim(` in ${cwd}`) : "";
    let renderedCommand = command.replace(/\r\n|\r|\n/g, " "); // no multiline
    if (renderedCommand.length > 60) {
      renderedCommand = `${renderedCommand.slice(0, 50)}...${chalk.dim(`(+${renderedCommand.length - 50})`)}`;
    }
    if (toolCall.state === "input-available") {
      return loading().start(
        `Running ${chalk.cyan(renderedCommand)}${cwdString}`,
      );
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      loading().succeed(`Ran ${chalk.cyan(renderedCommand)}${cwdString}`);
    } else {
      loading().fail(
        `Run ${chalk.cyan(renderedCommand)}${cwdString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  searchFiles: (
    toolCall: ToolProps<"searchFiles">,
    loading: () => loading.Loading,
  ) => {
    const { regex, path } = toolCall.input || {};
    const pathString = styledPathString(path);
    const regexString = chalk.magenta(regex);
    if (toolCall.state === "input-available") {
      return loading().start(`Searching ${regexString} in ${pathString}`);
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      const matchCount = toolCall.output.matches?.length || 0;
      const matchText = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
      const truncated = toolCall.output.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Found ${chalk.yellow(matchText)} for ${regexString} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `Search ${regexString} in ${pathString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  listFiles: (
    toolCall: ToolProps<"listFiles">,
    loading: () => loading.Loading,
  ) => {
    const { path } = toolCall.input || {};
    const pathString = styledPathString(path);
    if (toolCall.state === "input-available") {
      return loading().start(`Listing ${pathString}`);
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      const fileCount = toolCall.output.files?.length || 0;
      const fileText = `${fileCount} file${fileCount !== 1 ? "s" : ""}`;
      const truncated = toolCall.output.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Listed ${chalk.yellow(fileText)} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `List ${pathString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  globFiles: (
    toolCall: ToolProps<"globFiles">,
    loading: () => loading.Loading,
  ) => {
    const { globPattern, path } = toolCall.input || {};
    const pathString = styledPathString(path);
    const globPatternString = chalk.magenta(globPattern);
    if (toolCall.state === "input-available") {
      return loading().start(`Globbing ${globPatternString} in ${pathString}`);
    }
    if (!toolCall.output) return;
    if (!("error" in toolCall.output)) {
      const matchCount = toolCall.output.files?.length || 0;
      const matchText = `${matchCount} match${matchCount !== 1 ? "es" : ""}`;
      const truncated = toolCall.output.isTruncated
        ? chalk.dim(" (results truncated)")
        : "";
      loading().succeed(
        `Found ${chalk.yellow(matchText)} for ${globPatternString} in ${pathString}${truncated}`,
      );
    } else {
      loading().fail(
        `Glob ${globPatternString} in ${pathString} ${ErrorLabel} ${toolCall.output.error}`,
      );
    }
    return undefined;
  },
  // biome-ignore lint/suspicious/noExplicitAny: dynamic type
} as Record<string, ToolRenderer<any> | undefined>;

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
const LoadingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const LoadingFramesInterval = 100; // ms
