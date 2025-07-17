import {
  type ToolInvocationUIPart,
  generateId,
  getMessageParts,
  isAssistantMessageWithCompletedToolCalls,
  prepareAttachmentsForRequest,
  updateToolCallResult,
} from "@ai-sdk/ui-utils";
import { type Signal, signal } from "@preact/signals-core";
import {
  fromUIMessage,
  getLogger,
  prompts,
  toUIMessages,
} from "@ragdoll/common";
import {
  isAssistantMessageWithEmptyParts,
  isAssistantMessageWithNoToolCalls,
  isAssistantMessageWithPartialToolCalls,
  prepareLastMessageForRetry,
} from "@ragdoll/common/message-utils";
import { findTodos, mergeTodos } from "@ragdoll/common/todo-utils";
import type { Environment, TaskEvent, Todo } from "@ragdoll/db";
import {
  type AppType,
  createPochiEventSourceWithApiClient,
} from "@ragdoll/server";
import {
  ServerToolApproved,
  ServerTools,
  type ToolFunctionType,
} from "@ragdoll/tools";
import type { CreateMessage, Message, ToolInvocation, UIMessage } from "ai";
import type { hc } from "hono/client";
import { toError, toErrorString } from "./lib/error-utils";
import { readEnvironment } from "./lib/read-environment";
import { StepCount, type StepInfo } from "./lib/step-count";
import { withAttempts } from "./lib/with-attempts";
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

type ApiClient = ReturnType<typeof hc<AppType>>;

export type Task = Awaited<
  ReturnType<
    Awaited<ReturnType<ApiClient["api"]["tasks"][":uid"]["$get"]>>["json"]
  >
>;

export interface RunnerOptions {
  /**
   * The uid of the task to run.
   */
  uid: string;

  /**
   * Access token to authenticate the task runner with the server.
   */
  accessToken: string;

  /**
   * This is the API client used to communicate with the server.
   */
  apiClient: ApiClient;

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
   * The llm model to use for the task runner.
   */
  model?: string;

  /**
   * The llm model endpoint id to override pochi/pro-1
   */
  modelEndpointId?: string;

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
      message: UIMessage;
      messageReason: "next" | "retry";
    }
  | {
      type: "sending-message";
      phase: "end";
      message: UIMessage;
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
      messages: UIMessage[];
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
const ApiRequestTimeout = 60_000; // 60 seconds

const logger = getLogger("TaskRunner");

export class TaskRunner {
  private readonly logger: ReturnType<typeof getLogger>;
  private toolCallOptions: ToolCallOptions;
  private stepCount: StepCount;
  private abortController?: AbortController;

  private task?: Task;
  private messages: UIMessage[] = [];
  private todos: Todo[] = [];

  readonly state: Signal<TaskRunnerState>;

  constructor(readonly options: RunnerOptions) {
    this.logger = logger.getSubLogger({
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

      const task = this.getTaskOrThrow();
      const result = extractTaskResult(task);
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

    this.logger.trace("Loading task:", this.options.uid);
    this.updateState({
      state: "running",
      progress: {
        step: this.stepCount,
        type: "loading-task",
        phase: "begin",
      },
    });
    signal?.throwIfAborted();

    const task = await loadTaskAndWaitStreaming({
      uid: this.options.uid,
      apiClient: this.options.apiClient,
      abortSignal: signal,
    });
    this.task = task;

    this.messages = toUIMessages(task.conversation?.messages ?? []);
    const lastMessage = this.getLastMessageOrThrow();

    this.todos = mergeTodos(
      mergeTodos(this.todos, task.todos ?? []),
      findTodos(lastMessage) ?? [],
    );

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
      this.logger.trace(
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
      isAssistantMessageWithCompletedToolCalls(lastMessage)
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
      const message = await createUIMessage({
        role: "user",
        content: prompts.createSystemReminder(
          "You've been working on this task for a while and don't seem to be making progress. Please use askFollowupQuestion to engage with the user and clarify what they need, or use attemptCompletion if you think the task is complete.",
        ),
      });
      this.messages.push(message);
      return "next";
    }

    if (isAssistantMessageWithNoToolCalls(lastMessage)) {
      this.logger.trace(
        "Last message is assistant with no tool calls, sending a new user reminder.",
      );
      const message = await createUIMessage({
        role: "user",
        content: prompts.createSystemReminder(
          "You should use tool calls to answer the question, for example, use attemptCompletion if the job is done, or use askFollowupQuestions to clarify the request.",
        ),
      });
      this.messages.push(message);
      return "next";
    }

    /* otherwise, processing tool calls */ {
      this.logger.trace("Processing tool calls in the last message.");
      let toolCall = findNextToolCall(lastMessage);
      while (toolCall) {
        this.logger.trace(
          `Found tool call: ${toolCall.toolName} with args: ${JSON.stringify(
            toolCall.args,
          )}`,
        );
        this.updateState({
          state: "running",
          progress: {
            step: this.stepCount,
            type: "executing-tool-call",
            phase: "begin",
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            toolArgs: toolCall.args,
          },
        });
        signal?.throwIfAborted();

        const toolResult = await executeToolCall(
          toolCall,
          this.toolCallOptions,
          signal,
        );

        updateToolCallResult({
          messages: this.messages,
          toolCallId: toolCall.toolCallId,
          toolResult,
        });

        this.logger.trace(`Tool call result: ${JSON.stringify(toolResult)}`);
        this.updateState({
          state: "running",
          progress: {
            step: this.stepCount,
            type: "executing-tool-call",
            phase: "end",
            toolName: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
            toolArgs: toolCall.args,
            toolResult,
          },
        });
        signal?.throwIfAborted();

        toolCall = findNextToolCall(lastMessage);
      }
      this.logger.trace("All tool calls processed in the last message.");
      return "next";
    }
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

    const environment = await buildEnvironment(
      this.options.cwd,
      this.todos,
      signal,
    );

    await withAttempts(
      async () => {
        const timeout = AbortSignal.timeout(ApiRequestTimeout);
        const resp = await this.options.apiClient.api.chat.stream.$post(
          {
            json: {
              id: this.options.uid,
              message: fromUIMessage(lastMessage),
              environment,
              model: this.options.model,
              modelEndpointId: this.options.modelEndpointId,
            },
          },
          {
            init: {
              signal: AbortSignal.any([timeout, ...(signal ? [signal] : [])]),
            },
          },
        );
        if (!resp.ok) {
          const error = await resp.text();
          throw new Error(
            `Failed to send message: ${resp.statusText}: ${error}`,
          );
        }
      },
      { abortSignal: signal },
    );

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
    signal?.throwIfAborted();
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

  private getLastMessageOrThrow(): UIMessage {
    const lastMessage = this.messages.at(-1);
    if (!lastMessage) {
      throw new Error("No messages found in the task.");
    }
    return lastMessage;
  }
}

const WaitTaskStreamingTimeout = 120_000; // 120 seconds

/**
 * Loads the task and waits for it to be in a non-streaming state.
 */
async function loadTaskAndWaitStreaming({
  uid,
  apiClient,
  abortSignal,
}: {
  uid: string;
  apiClient: ApiClient;
  abortSignal?: AbortSignal;
}): Promise<Task> {
  const loadTask = async () => {
    return await withAttempts(
      async () => {
        const timeout = AbortSignal.timeout(ApiRequestTimeout);
        const resp = await apiClient.api.tasks[":uid"].$get(
          {
            param: {
              uid,
            },
          },
          {
            init: {
              signal: AbortSignal.any([
                timeout,
                ...(abortSignal ? [abortSignal] : []),
              ]),
            },
          },
        );
        if (!resp.ok) {
          const error = await resp.text();
          throw new Error(`Failed to fetch task: ${resp.statusText}: ${error}`);
        }
        return await resp.json();
      },
      { abortSignal },
    );
  };

  return new Promise<Task>((resolve, reject) => {
    const cleanups: (() => void)[] = [];
    const runCleanups = () => {
      const cleanupFns = cleanups.splice(0, cleanups.length).reverse();
      for (const cleanup of cleanupFns) {
        cleanup();
      }
    };
    const cleanupAndResolve = (task: Task | Promise<Task>) => {
      runCleanups();
      resolve(task);
    };
    const cleanupAndReject = (error: Error) => {
      runCleanups();
      reject(error);
    };

    // Fetch and subscribe to task status events
    const taskEventSource = createPochiEventSourceWithApiClient(uid, apiClient);
    const unsubscribe = taskEventSource.subscribe<TaskEvent>(
      "task:status-changed",
      ({ data }) => {
        if (data.uid !== uid) {
          return;
        }
        if (data.status !== "streaming") {
          cleanupAndResolve(loadTask());
        }
      },
    );
    cleanups.push(() => {
      unsubscribe();
      taskEventSource.dispose();
    });

    // Set a timeout to check if the task is still streaming after 120 seconds
    const timeout = setTimeout(() => {
      loadTask()
        .then((task) => {
          if (task.status !== "streaming") {
            cleanupAndResolve(task);
          } else {
            cleanupAndReject(
              new Error(
                `Task ${uid} is still streaming after ${WaitTaskStreamingTimeout} ms timeout.`,
              ),
            );
          }
        })
        .catch((error) => {
          cleanupAndReject(error);
        });
    }, WaitTaskStreamingTimeout);
    cleanups.push(() => {
      clearTimeout(timeout);
    });

    if (abortSignal) {
      abortSignal.addEventListener(
        "abort",
        () => {
          cleanupAndReject(abortSignal.reason);
        },
        { once: true },
      );
    }
  });
}

async function buildEnvironment(
  cwd: string,
  todos: Todo[],
  signal?: AbortSignal,
): Promise<Environment> {
  return new Promise<Environment>((resolve, reject) => {
    readEnvironment({ cwd }).then((environment) => {
      resolve({
        ...environment,
        todos,
      });
    });

    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          reject(signal.reason);
        },
        { once: true },
      );
    }
  });
}

async function createUIMessage(
  message: Message | CreateMessage,
): Promise<UIMessage> {
  const attachmentsForRequest = await prepareAttachmentsForRequest(
    message.experimental_attachments,
  );
  return {
    ...message,
    id: message.id ?? generateId(),
    createdAt: message.createdAt ?? new Date(),
    experimental_attachments:
      attachmentsForRequest.length > 0 ? attachmentsForRequest : undefined,
    parts: getMessageParts(message),
  };
}

function findNextToolCall(message: UIMessage): ToolInvocation | undefined {
  for (const part of message.parts) {
    if (
      part.type === "tool-invocation" &&
      part.toolInvocation.state === "call"
    ) {
      return part.toolInvocation;
    }
  }
}

async function executeToolCall(
  tool: ToolInvocation,
  options: ToolCallOptions,
  abortSignal?: AbortSignal,
) {
  if (tool.toolName in ServerTools) {
    return ServerToolApproved;
  }

  const toolFunction = ToolMap[tool.toolName];
  if (!toolFunction) {
    return {
      error: `Tool ${tool.toolName} not found.`,
    };
  }

  try {
    return await toolFunction(options)(tool.args, {
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
    (message.parts?.some(
      (part) =>
        part.type === "tool-invocation" &&
        (part.toolInvocation.toolName === "attemptCompletion" ||
          part.toolInvocation.toolName === "askFollowupQuestion"),
    ) ??
      false)
  );
}

export function extractTaskResult(task: Task): string {
  const messages = toUIMessages(task.conversation?.messages || []);
  const lastMessage = messages.at(-1);
  if (!lastMessage) {
    throw new Error("No messages found in the task.");
  }

  if (lastMessage.role !== "assistant") {
    throw new Error(
      `Last message is not an assistant message, got: ${lastMessage.role}`,
    );
  }

  const attemptCompletionPart = lastMessage.parts.findLast(
    (part): part is ToolInvocationUIPart =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "attemptCompletion",
  );
  if (attemptCompletionPart) {
    return attemptCompletionPart.toolInvocation.args.result;
  }

  const askFollowupQuestionPart = lastMessage.parts.findLast(
    (part): part is ToolInvocationUIPart =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "askFollowupQuestion",
  );
  if (askFollowupQuestionPart) {
    return JSON.stringify({
      question: askFollowupQuestionPart.toolInvocation.args.question,
      followUp: askFollowupQuestionPart.toolInvocation.args.followUp,
    });
  }

  throw new Error("No result found in the last message.");
}
