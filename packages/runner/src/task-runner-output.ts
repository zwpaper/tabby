import { formatters } from "@ragdoll/common";
import type { ClientToolsType, ToolFunctionType } from "@ragdoll/tools";
import type { Tool, ToolCall, ToolResult, UIMessage } from "ai";
import chalk from "chalk";
import deepEqual from "fast-deep-equal";
import loading from "loading-cli";
import PrettyError from "pretty-error";

export class TaskRunnerOutputStream {
  private parts: UIMessage["parts"] = [];
  private loading: loading.Loading | undefined;

  constructor(readonly stream: NodeJS.WriteStream) {}

  updateMessage(messages: UIMessage[]) {
    const formattedMessages = formatters.ui(messages);
    for (const message of formattedMessages) {
      if (message.role !== "user" && message.role !== "assistant") {
        continue; // Only render user and assistant messages
      }
      for (const part of message.parts) {
        if (this.parts.some((p) => deepEqual(p, part))) {
          continue; // Skip already rendered parts
        }
        this.parts.push(part);

        switch (part.type) {
          case "text":
            this.renderTextPart(message.role, part.text);
            break;
          case "reasoning":
            this.renderReasoningPart(part.reasoning);
            break;
          case "tool-invocation":
            {
              if (part.toolInvocation.state === "partial-call") {
                // skip rendering for partial calls
              } else if (part.toolInvocation.toolName in CommonToolRenderers) {
                this.renderToolCallPart(part.toolInvocation);
              } else if (part.toolInvocation.toolName in RunnerToolRenderers) {
                if (part.toolInvocation.state === "result") {
                  this.renderToolCallPart(part.toolInvocation);
                } else {
                  // ignore all `call` state tool invocations,
                  // they should be rendered by `updateToolCall`
                }
              } else {
                this.renderRawJson(
                  JSON.stringify(part.toolInvocation, null, 2),
                );
              }
            }
            break;
          default:
            // not support other types
            break;
        }
      }
    }
  }

  updateToolCall(toolCall: ToolInvocation) {
    this.renderToolCallPart(toolCall);
  }

  updateIsLoading(isLoading: boolean, label?: string) {
    this.finishRenderCurrentToolCall();
    if (isLoading) {
      this.loading = loading({
        text: label || "Loading...",
        frames: LoadingFrames,
        stream: this.stream,
        interval: 100,
      }).start();
    } else {
      this.loading?.stop();
      this.loading = undefined;
    }
  }

  printText(text: string) {
    this.stream.write(text);
  }

  println() {
    this.stream.write("\n");
  }
  printError(error: Error) {
    this.println();
    const pretty = new PrettyError().render(error);
    this.printText(pretty);
  }

  finish() {
    this.println();
    this.stream.write("\x1b[?25h"); // ANSI escape sequences to show cursor
  }

  private renderRawJson(json: string) {
    this.finishRenderCurrentToolCall();

    this.printText(json);
    this.println();
  }

  private renderTextPart(role: "user" | "assistant", text: string) {
    this.finishRenderCurrentToolCall();

    const roleName =
      role === "assistant"
        ? chalk.bold(chalk.blue("Pochi"))
        : chalk.bold(chalk.green("You"));
    this.printText(`${roleName}: ${text}`);
    this.println();
  }

  private renderReasoningPart(_reasoning: string) {
    this.finishRenderCurrentToolCall();

    this.printText(chalk.italic(chalk.gray("Pochi is thinking...")));
    this.println();
  }

  private currentRenderingToolCall: ToolInvocation | undefined = undefined;

  private finishRenderCurrentToolCall() {
    if (this.currentRenderingToolCall) {
      this.currentRenderingToolCall = undefined;
      this.println();
    }
  }

  private renderToolCallPart(toolCall: ToolInvocation) {
    const renderers = { ...CommonToolRenderers, ...RunnerToolRenderers };
    const renderer = renderers[toolCall.toolName];
    if (!renderer) {
      return;
    }

    if (
      this.currentRenderingToolCall &&
      this.currentRenderingToolCall.toolCallId !== toolCall.toolCallId
    ) {
      this.println();
    } else {
      this.rewind();
    }
    this.loading?.stop();
    this.loading = undefined;

    this.currentRenderingToolCall = toolCall;

    const icon: ToolStateIconSet = {
      loading: (text: string) => {
        return loading({
          text,
          frames: LoadingFrames,
          stream: this.stream,
          interval: 100,
        });
      },
      done: chalk.green("✓"),
      error: chalk.red("✗"),
    };
    const rendered = renderer(toolCall, icon);
    if (typeof rendered === "string") {
      this.printText(rendered);
    } else {
      this.loading = rendered.start();
    }
  }

  private rewind() {
    this.stream.write("\r");
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

type ToolStateIconSet = {
  loading: (text: string) => loading.Loading;
  done: string;
  error: string;
};

type ToolRenderer<T extends Tool> = (
  tool: ToolProps<T>,
  icon: ToolStateIconSet,
) => string | loading.Loading;

const CommonToolRenderers: Record<string, ToolRenderer<Tool> | undefined> = {
  attemptCompletion: (
    toolCall: ToolProps<ClientToolsType["attemptCompletion"]>,
    icon: ToolStateIconSet,
  ) => {
    const { result } = toolCall.args || {};
    return `${icon.done} Task Completed: ${result}`;
  },
  askFollowupQuestion: (
    toolCall: ToolProps<ClientToolsType["askFollowupQuestion"]>,
  ) => {
    const { question, followUp } = toolCall.args || {};
    return `${question}\n${followUp.reduce((acc, curr) => `${acc}\n- ${curr}`, "")}`;
  },
  // biome-ignore lint/suspicious/noExplicitAny: ToolProps<ServerToolsType["webFetch"]>
  webFetch: (toolCall: any, icon: ToolStateIconSet) => {
    const { url } = toolCall.args || {};
    return `${icon.done} Read: ${url}`;
  },
  todoWrite: undefined,
  newTask: undefined,
};

const RunnerToolRenderers: Record<string, ToolRenderer<Tool> | undefined> = {
  readFile: (
    toolCall: ToolProps<ClientToolsType["readFile"]>,
    icon: ToolStateIconSet,
  ) => {
    const { path, startLine, endLine } = toolCall.args || {};
    const pathString = `${path}${startLine !== undefined && endLine !== undefined ? `:L${startLine}-${endLine}` : ""}`;
    return toolCall.state === "call"
      ? icon.loading(`Read: ${pathString}`)
      : !("error" in toolCall.result)
        ? `${icon.done} Read: ${pathString}`
        : `${icon.error} Read: ${pathString} (error: ${toolCall.result.error})`;
  },
  writeToFile: (
    toolCall: ToolProps<ClientToolsType["writeToFile"]>,
    icon: ToolStateIconSet,
  ) => {
    const { path } = toolCall.args || {};
    return toolCall.state === "call"
      ? icon.loading(`Write: ${path}`)
      : !("error" in toolCall.result)
        ? `${icon.done} Write: ${path}`
        : `${icon.error} Write: ${path} (error: ${toolCall.result.error})`;
  },
  applyDiff: (
    toolCall: ToolProps<ClientToolsType["applyDiff"]>,
    icon: ToolStateIconSet,
  ) => {
    const {
      path,
      searchContent,
      replaceContent,
      expectedReplacements = 1,
    } = toolCall.args || {};
    const countLines = (content: string) => {
      return content.split("\n").length;
    };
    const deletedLines = countLines(searchContent) * expectedReplacements;
    const addedLines = countLines(replaceContent) * expectedReplacements;
    return toolCall.state === "call"
      ? icon.loading(`Apply diff to: ${path} +${addedLines}-${deletedLines}`)
      : !("error" in toolCall.result)
        ? `${icon.done} Apply diff to: ${path} +${addedLines}-${deletedLines}`
        : `${icon.error} Apply diff to: ${path} +${addedLines}-${deletedLines} (error: ${toolCall.result.error})`;
  },
  multiApplyDiff: (
    toolCall: ToolProps<ClientToolsType["multiApplyDiff"]>,
    icon: ToolStateIconSet,
  ) => {
    const { path, edits } = toolCall.args || {};
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
    return toolCall.state === "call"
      ? icon.loading(`Apply diff to: ${path} +${addedLines}-${deletedLines}`)
      : !("error" in toolCall.result)
        ? `${icon.done} Apply diff to: ${path} +${addedLines}-${deletedLines}`
        : `${icon.error} Apply diff to: ${path} +${addedLines}-${deletedLines} (error: ${toolCall.result.error})`;
  },
  executeCommand: (
    toolCall: ToolProps<ClientToolsType["executeCommand"]>,
    icon: ToolStateIconSet,
  ) => {
    const { command, cwd } = toolCall.args || {};
    let renderedCommand = command.replace(/\r\n|\r|\n/g, " "); // no multiline
    if (renderedCommand.length > 60) {
      renderedCommand = `${renderedCommand.slice(0, 57)}...`;
    }
    if (toolCall.state === "result") {
      if (!("error" in toolCall.result)) {
        return `${icon.done} Executed Command: ${renderedCommand} ${cwd ? `in ${cwd}` : ""}`;
      }
      return `${icon.error} Executed Command: ${renderedCommand} ${cwd ? `in ${cwd}` : ""}, error: ${toolCall.result.error}`;
    }
    return icon.loading(
      `Executing Command: ${renderedCommand} ${cwd ? `in ${cwd}` : ""}`,
    );
  },
  searchFiles: (
    toolCall: ToolProps<ClientToolsType["searchFiles"]>,
    icon: ToolStateIconSet,
  ) => {
    const { regex, path } = toolCall.args || {};
    if (toolCall.state === "result") {
      if (!("error" in toolCall.result)) {
        const { matches } = toolCall.result || {};
        return `${icon.done} Searched ${regex} in ${path}, ${matches?.length || 0} match${matches?.length !== 1 ? "es" : ""}${
          toolCall.result.isTruncated ? ", results truncated" : ""
        }`;
      }
      return `${icon.error} Searched ${regex} in ${path}, error: ${toolCall.result.error}`;
    }
    return icon.loading(`Searching: ${regex} in ${path}`);
  },
  listFiles: (
    toolCall: ToolProps<ClientToolsType["listFiles"]>,
    icon: ToolStateIconSet,
  ) => {
    const { path } = toolCall.args || {};
    if (toolCall.state === "result") {
      if (!("error" in toolCall.result)) {
        const { files } = toolCall.result || {};
        return `${icon.done} Read ${path}, ${files?.length || 0} result${files?.length !== 1 ? "s" : ""}${toolCall.result.isTruncated ? ", results truncated" : ""}`;
      }
      return `${icon.error} Read ${path}, error: ${toolCall.result.error}`;
    }
    return icon.loading(`Reading ${path}`);
  },
  globFiles: (
    toolCall: ToolProps<ClientToolsType["globFiles"]>,
    icon: ToolStateIconSet,
  ) => {
    const { globPattern, path } = toolCall.args || {};
    if (toolCall.state === "result") {
      if (!("error" in toolCall.result)) {
        const { files } = toolCall.result || {};
        return `${icon.done} Searched ${globPattern} in ${path}, ${files?.length || 0} match${files?.length !== 1 ? "es" : ""}${
          toolCall.result.isTruncated ? ", results truncated" : ""
        }`;
      }
      return `${icon.error} Searched ${globPattern} in ${path}, error: ${toolCall.result.error}`;
    }
    return icon.loading(`Searching: ${globPattern} in ${path}`);
  },
};

const LoadingFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
