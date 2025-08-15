import {
  type ToolUIPart,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "@ai-v5-sdk/ai";
import {
  type Todo,
  type ToolFunctionType,
  isUserInputToolPart,
} from "@getpochi/tools";
import type { Store } from "@livestore/livestore";
import { type Signal, signal } from "@preact/signals-core";
import type { Environment } from "@ragdoll/common";
import { getLogger, prompts } from "@ragdoll/common";
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
  isAssistantMessageWithPartialToolCalls,
  prepareLastMessageForRetry,
} from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/message-utils";
import type { LLMRequestData, Message, Task, UITools } from "@ragdoll/livekit";
import { LiveChatKit } from "@ragdoll/livekit/node";
import { toError, toErrorString } from "./lib/error-utils";
import { readEnvironment } from "./lib/read-environment";
import { StepCount, type StepInfo } from "./lib/step-count";
import { Chat } from "./livekit";
import { applyDiff } from "./tools/apply-diff";
import { executeCommand } from "./tools/execute-command";
import { globFiles } from "./tools/glob-files";
import { listFiles } from "./tools/list-files";
import { multiApplyDiff } from "./tools/multi-apply-diff";
import { readFile } from "./tools/read-file";
import { searchFiles } from "./tools/search-files";
import { todoWrite } from "./tools/todo-write";
import { writeToFile } from "./tools/write-to-file";
import type { ToolCallOptions } from "./types";

export interface RunnerOptions {
  /**
   * The uid of the task to run.
   */
  uid: string;

  llm: LLMRequestData;

  store: Store;

  // The prompt to use for creating the task
  prompt?: string;

  /**
   * The current working directory for the task runner.
   * This is used to determine where to read/write files and execute commands.
   * It should be an absolute path.
   */
  cwd: string;

  /**
   * The path to the ripgrep executable.
   * This is used for searching files in the task runner.
   */
  rg: string;

  /**
   * Force stop the runner after max rounds reached.
   * If a task cannot be completed in max rounds, it is likely stuck in an infinite loop.
   */
  maxRounds?: number;

  /**
   * Force stop the runner after max retries reached in a single round.
   */
  maxRetries?: number;

  // Add more context properties here as needed in the future
  // e.g., environment variables, workspace settings, etc.
}

type TaskRunnerProgress = { step: StepInfo } & (
  | {
      type: "loading-task";
      phase: "begin";
    }
  | {
      type: "loading-task";
      phase: "end";
      task: Task;
    }
  | {
      type: "executing-tool-call";
      phase: "begin";
      toolName: string;
      toolCallId: string;
      toolArgs: unknown;
    }
  | {
      type: "executing-tool-call";
      phase: "end";
      toolName: string;
      toolCallId: string;
      toolArgs: unknown;
      toolResult: unknown;
    }
  | {
      type: "sending-message";
      phase: "begin";
      message: Message;
      messageReason: "next" | "retry";
    }
  | {
      type: "sending-message";
      phase: "end";
      message: Message;
      messageReason: "next" | "retry";
    }
);

export type TaskRunnerState =
  | {
      state: "initial";
    }
  | ((
      | {
          state: "running";
          progress: TaskRunnerProgress;
        }
      | {
          state: "stopped";
          result: string;
        }
      | {
          state: "error";
          error: Error;
        }
    ) & {
      task?: Task;
      messages: Message[];
      todos: Todo[];
    });

const ToolMap: Record<
  string,
  // biome-ignore lint/suspicious/noExplicitAny: ToolFunctionType requires any for generic tool parameters
  (options: ToolCallOptions) => ToolFunctionType<any>
> = {
  readFile,
  applyDiff,
  globFiles,
  listFiles,
  multiApplyDiff,
  todoWrite,
  writeToFile,
  searchFiles,
  executeCommand,
};

const DefaultMaxRounds = 24;
const DefaultMaxRetries = 3;
// const ApiRequestTimeout = 60_000; // 60 seconds

const baseLogger = getLogger("TaskRunner");

export class TaskRunner {
  private readonly logger: ReturnType<typeof getLogger>;
  private toolCallOptions: ToolCallOptions;
  private stepCount: StepCount;
  private abortController?: AbortController;

  private task?: Task;
  private get messages(): Message[] {
    return this.chatKit.chat.messages;
  }
  private todos: Todo[] = [];
  private chatKit: LiveChatKit<Chat>;

  readonly state: Signal<TaskRunnerState>;

  constructor(options: RunnerOptions) {
    this.logger = baseLogger.getSubLogger({
      name: `task-${options.uid}`,
    });
    this.state = signal({
      state: "initial",
    });
    this.toolCallOptions = {
      cwd: options.cwd,
      rg: options.rg,
    };
    this.stepCount = new StepCount(
      options.maxRounds ?? DefaultMaxRounds,
      options.maxRetries ?? DefaultMaxRetries,
    );
    this.chatKit = new LiveChatKit<Chat>({
      taskId: options.uid,
      store: options.store,
      chatClass: Chat,
      getters: {
        getLLM: () => {
          return options.llm;
        },
        getEnvironment: () => {
          return buildEnvironment(options.cwd, this.todos);
        },
      },
    });
    if (options.prompt) {
      this.chatKit.init(options.prompt);
    }
  }

  start() {
    if (this.abortController !== undefined) {
      throw new Error("TaskRunner is already running.");
    }
    this.logger.trace("Start.");
    this.run();
  }

  stop(reason?: Error) {
    if (this.abortController !== undefined) {
      this.logger.trace("Stop.");
      this.abortController.abort(reason);
    } else {
      throw new Error("TaskRunner is not running.");
    }
  }

  private async run(): Promise<void> {
    const abortController = new AbortController();
    this.abortController = abortController;

    const finishWithState = (
      state:
        | {
            state: "stopped";
            result: string;
          }
        | {
            state: "error";
            error: Error;
          },
    ) => {
      if (this.abortController === abortController) {
        this.abortController = undefined;
      }

      this.updateState(state);
    };

    try {
      this.logger.trace("Start step loop.");
      this.stepCount.reset();
      while (true) {
        const stepResult = await this.step();
        if (stepResult === "finished") {
          break;
        }
        if (stepResult === "retry") {
          this.stepCount.nextRetry();
        } else {
          this.stepCount.nextRound();
        }
      }

      const result = extractTaskResult(this.messages);
      this.logger.trace("Completed with result:", result);

      finishWithState({
        state: "stopped",
        result,
      });
    } catch (e) {
      const error = toError(e);
      this.logger.trace("Failed:", error);

      finishWithState({
        state: "error",
        error,
      });
    }
  }

  /**
   * @returns
   *  - "finished" if the task is finished and no more steps are needed.
   *  - "next" if the task is not finished and needs next round.
   *  - "retry" if the task is not finished and needs to retry the current round.
   * @throws {Error} - Throws an error if this step is failed.
   */
  private async step(): Promise<"finished" | "next" | "retry"> {
    await this.loadTask();

    const result = await this.processMessage();
    if (result === "finished") {
      return "finished";
    }
    if (result === "next") {
      this.stepCount.throwIfReachedMaxRounds();
    }
    if (result === "retry") {
      this.stepCount.throwIfReachedMaxRetries();
    }

    await this.sendMessage(result);
    return result;
  }

  private async loadTask() {
    const signal = this.abortController?.signal;

    this.logger.trace("Loading task:", this.chatKit.chat.id);
    this.updateState({
      state: "running",
      progress: {
        step: this.stepCount,
        type: "loading-task",
        phase: "begin",
      },
    });
    signal?.throwIfAborted();

    const task = this.chatKit.task;
    if (!task) {
      throw new Error("Task not found");
    }
    this.task = task;
    const lastMessage = this.getLastMessageOrThrow();

    this.todos = mergeTodos(this.todos, findTodos(lastMessage) ?? []);

    this.logger.trace("Task loaded:", task);
    this.updateState({
      state: "running",
      progress: {
        step: this.stepCount,
        type: "loading-task",
        phase: "end",
        task,
      },
    });
    signal?.throwIfAborted();
  }

  private async processMessage(): Promise<"finished" | "next" | "retry"> {
    const signal = this.abortController?.signal;
    signal?.throwIfAborted();

    const task = this.getTaskOrThrow();
    const lastMessage = this.getLastMessageOrThrow();

    if (
      (task.status === "completed" || task.status === "pending-input") &&
      isResultMessage(lastMessage)
    ) {
      this.logger.trace(
        "Task is completed or pending input, no more steps to process.",
      );
      return "finished";
    }

    if (task.status === "failed") {
      this.logger.error(
        "Task is failed, trying to resend last message to resume it.",
        task.error,
      );
      return "retry";
    }

    if (lastMessage.role !== "assistant") {
      this.logger.trace(
        "Last message is not a assistant message, resending it to resume the task.",
      );
      return "retry";
    }

    if (
      isAssistantMessageWithEmptyParts(lastMessage) ||
      isAssistantMessageWithPartialToolCalls(lastMessage) ||
      lastAssistantMessageIsCompleteWithToolCalls({ messages: this.messages })
    ) {
      this.logger.trace(
        "Last message is assistant with empty parts or partial/completed tool calls, resending it to resume the task.",
      );
      const processed = prepareLastMessageForRetry(lastMessage);
      if (processed) {
        this.messages.splice(-1, 1, processed);
      } else {
        // skip, the last message is ready to be resent
      }
      return "retry";
    }

    if (this.stepCount.willReachMaxRounds()) {
      this.logger.trace("Will reach max rounds, sending a new user reminder.");
      const message = await createUserMessage(
        prompts.createSystemReminder(
          "You've been working on this task for a while and don't seem to be making progress. Please use askFollowupQuestion to engage with the user and clarify what they need, or use attemptCompletion if you think the task is complete.",
        ),
      );
      this.messages.push(message);
      return "next";
    }

    if (isAssistantMessageWithNoToolCalls(lastMessage)) {
      this.logger.trace(
        "Last message is assistant with no tool calls, sending a new user reminder.",
      );
      const message = createUserMessage(
        prompts.createSystemReminder(
          "You should use tool calls to answer the question, for example, use attemptCompletion if the job is done, or use askFollowupQuestions to clarify the request.",
        ),
      );
      this.messages.push(message);
      return "next";
    }
    this.logger.trace("Processing tool calls in the last message.");
    for (const toolCall of lastMessage.parts.filter(isToolUIPart)) {
      if (toolCall.state !== "input-available") continue;
      const toolName = getToolName(toolCall);
      this.logger.trace(
        `Found tool call: ${toolName} with args: ${JSON.stringify(
          toolCall.input,
        )}`,
      );
      this.updateState({
        state: "running",
        progress: {
          step: this.stepCount,
          type: "executing-tool-call",
          phase: "begin",
          toolName,
          toolCallId: toolCall.toolCallId,
          toolArgs: toolCall.input,
        },
      });
      signal?.throwIfAborted();

      const toolResult = await executeToolCall(
        toolCall,
        this.toolCallOptions,
        signal,
      );

      this.chatKit.chat.addToolResult({
        // @ts-expect-error
        tool: toolName,
        toolCallId: toolCall.toolCallId,
        // @ts-expect-error
        output: toolResult,
      });

      this.logger.trace(`Tool call result: ${JSON.stringify(toolResult)}`);
      this.updateState({
        state: "running",
        progress: {
          step: this.stepCount,
          type: "executing-tool-call",
          phase: "end",
          toolName,
          toolCallId: toolCall.toolCallId,
          toolArgs: toolCall.input,
          toolResult,
        },
      });
      signal?.throwIfAborted();
    }
    this.logger.trace("All tool calls processed in the last message.");
    return "next";
  }

  private async sendMessage(messageReason: "next" | "retry") {
    const signal = this.abortController?.signal;

    const lastMessage = this.getLastMessageOrThrow();

    this.logger.trace("Sending message:", lastMessage);
    this.updateState({
      state: "running",
      progress: {
        step: this.stepCount,
        type: "sending-message",
        phase: "begin",
        message: lastMessage,
        messageReason,
      },
    });
    signal?.throwIfAborted();

    this.chatKit.chat.appendMessage(lastMessage);
    const promise = this.chatKit.chat.sendMessage(undefined);

    signal?.addEventListener("abort", () => this.chatKit.chat.stop());

    this.logger.trace("Message sent successfully.");
    this.updateState({
      state: "running",
      progress: {
        step: this.stepCount,
        type: "sending-message",
        phase: "end",
        message: lastMessage,
        messageReason,
      },
    });
    return promise;
  }

  private updateState(
    state:
      | {
          state: "running";
          progress: TaskRunnerProgress;
        }
      | {
          state: "stopped";
          result: string;
        }
      | {
          state: "error";
          error: Error;
        },
  ) {
    this.state.value = {
      ...state,
      task: this.task,
      messages: this.messages,
      todos: this.todos,
    };
  }

  private getTaskOrThrow() {
    if (!this.task) {
      throw new Error("Task is not loaded.");
    }
    return this.task;
  }

  private getLastMessageOrThrow(): Message {
    const lastMessage = this.messages.at(-1);
    if (!lastMessage) {
      throw new Error("No messages found in the task.");
    }
    return lastMessage;
  }
}

async function buildEnvironment(
  cwd: string,
  todos: Todo[],
): Promise<Environment> {
  return new Promise<Environment>((resolve) => {
    readEnvironment({ cwd }).then((environment) => {
      resolve({
        ...environment,
        todos,
      });
    });
  });
}

function createUserMessage(prompt: string): Message {
  return {
    id: crypto.randomUUID(),
    role: "user",
    parts: [
      {
        type: "text",
        text: prompt,
      },
    ],
  };
}

async function executeToolCall(
  tool: ToolUIPart<UITools>,
  options: ToolCallOptions,
  abortSignal?: AbortSignal,
) {
  const toolName = getToolName(tool);
  const toolFunction = ToolMap[toolName];
  if (!toolFunction) {
    return {
      error: `Tool ${toolName} not found.`,
    };
  }

  try {
    return await toolFunction(options)(tool.input, {
      messages: [],
      toolCallId: tool.toolCallId,
      abortSignal,
    });
  } catch (e) {
    return {
      error: toErrorString(e),
    };
  }
}

function isResultMessage(message: Message): boolean {
  return (
    message.role === "assistant" &&
    (message.parts?.some(isUserInputToolPart) ?? false)
  );
}

export function extractTaskResult(messages: Message[]): string {
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    throw new Error("No messages found in the task.");
  }

  if (lastMessage.role !== "assistant") {
    throw new Error(
      `Last message is not an assistant message, got: ${lastMessage.role}`,
    );
  }

  for (const part of lastMessage.parts) {
    if (
      part.type === "tool-attemptCompletion" &&
      part.state !== "input-streaming"
    ) {
      return part.input.result;
    }

    if (
      part.type === "tool-askFollowupQuestion" &&
      part.state !== "input-streaming"
    ) {
      return JSON.stringify(part.input);
    }
  }

  throw new Error("No result found in the last message.");
}
