import { vscodeHost } from "@/lib/vscode";
import type { ClientToolsType } from "@getpochi/tools";
import {
  ThreadAbortSignal,
  type ThreadAbortSignalSerialization,
} from "@quilted/threads";
import {
  type ThreadSignalSerialization,
  threadSignal,
} from "@quilted/threads/signals";
import { getLogger } from "@ragdoll/common";
import type { TaskRunnerState } from "@ragdoll/runner";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
// FIXME(meng): upgrade this to v5
// ast-grep-ignore: no-ai-sdk-v4
import type { ToolInvocation } from "ai";
import Emittery from "emittery";
import type z from "zod";
import type { ToolCallLifeCycleKey } from "./chat-state/types";

type PreviewReturnType = { error: string } | undefined;
type ExecuteCommandReturnType = {
  output: ThreadSignalSerialization<ExecuteCommandResult>;
  detach: () => void;
};
type NewTaskParameterType = z.infer<ClientToolsType["newTask"]["parameters"]>;
type NewTaskReturnType = {
  result: ThreadSignalSerialization<TaskRunnerState>;
};
type ExecuteReturnType = ExecuteCommandReturnType | NewTaskReturnType | unknown;

type StreamingResult =
  | {
      toolName: "executeCommand";
      output: ExecuteCommandResult;
      detach: () => void;
    }
  | {
      toolName: "newTask";
      state: TaskRunnerState;
    };

type CompleteReason =
  | "execute-finish"
  | "user-reject"
  | "preview-reject"
  | "user-detach"
  | "user-abort";

type ToolCallState =
  | {
      // Represents preview runs at toolCall.state === "partial-call"
      type: "init";
      previewJob: Promise<PreviewReturnType>;
    }
  | {
      // Represents the preview runs at toolCall.state === "call"
      type: "pending";
      previewJob: Promise<PreviewReturnType>;
      abortController: AbortController;
    }
  | {
      type: "ready";
      abortController: AbortController;
    }
  | {
      type: "execute";
      executeJob: Promise<ExecuteReturnType>;
      // Controller to abort the execute job
      abortController: AbortController;
    }
  | {
      type: "execute:streaming";
      abortController: AbortController;
      streamingResult: StreamingResult;
    }
  | {
      type: "complete";
      result: unknown;
      reason: CompleteReason;
    }
  | {
      type: "dispose";
    };

type ToolCallLifeCycleEvents = {
  [K in ToolCallState["type"]]: Extract<ToolCallState, { type: K }>;
};

export interface ToolCallLifeCycle {
  readonly toolName: string;
  readonly toolCallId: string;

  readonly status: ToolCallState["type"];

  /**
   * Streaming result data if available.
   * Returns undefined if not in streaming state.
   */
  readonly streamingResult: StreamingResult | undefined;

  /**
   * Completion result and reason.
   * Should only be accessed when the lifecycle is in complete state.
   */
  readonly complete: {
    result: unknown;
    reason: CompleteReason;
  };

  dispose(): void;

  /**
   * Preview the tool call with given arguments and state.
   * @param args - Tool call arguments
   * @param state - Current tool invocation state
   */
  preview(args: unknown, state: ToolInvocation["state"]): void;

  /**
   * Execute the tool call with given arguments and options.
   * @param args - Tool call arguments
   * @param options - Execution options including model selection
   */
  execute(args: unknown, options: { model?: string }): void;

  /**
   * Abort the currently executing tool call.
   */
  abort(): void;

  /**
   * Reject the tool call, preventing execution.
   */
  reject(): void;
}

const logger = getLogger("ToolCallLifeCycle");

export class ManagedToolCallLifeCycle
  extends Emittery<ToolCallLifeCycleEvents>
  implements ToolCallLifeCycle
{
  private state: ToolCallState = {
    type: "init",
    previewJob: Promise.resolve(undefined),
  };

  readonly toolName: string;
  readonly toolCallId: string;

  constructor(key: ToolCallLifeCycleKey) {
    super();
    this.toolName = key.toolName;
    this.toolCallId = key.toolCallId;
  }

  get status() {
    return this.state.type;
  }

  get streamingResult() {
    return this.state.type === "execute:streaming"
      ? this.state.streamingResult
      : undefined;
  }

  get complete() {
    const complete = this.checkState("Result", "complete");
    return {
      result: complete.result,
      reason: complete.reason,
    };
  }

  dispose() {
    this.transitTo("complete", { type: "dispose" });
  }

  preview(args: unknown, state: ToolInvocation["state"]) {
    if (this.status === "ready") {
      this.previewReady(args, state);
    } else {
      this.previewInit(args, state);
    }
  }

  private previewReady(args: unknown, state: ToolInvocation["state"]) {
    const { abortController } = this.checkState("Preview", "ready");
    vscodeHost.previewToolCall(this.toolName, args, {
      state,
      toolCallId: this.toolCallId,
      abortSignal: ThreadAbortSignal.serialize(abortController.signal),
    });
  }

  private previewInit(args: unknown, state: ToolInvocation["state"]) {
    let { previewJob } = this.checkState("Preview", "init");
    const previewToolCall = (abortSignal?: AbortSignal) =>
      vscodeHost.previewToolCall(this.toolName, args, {
        state,
        toolCallId: this.toolCallId,
        abortSignal: abortSignal
          ? ThreadAbortSignal.serialize(abortSignal)
          : undefined,
      });

    if (state === "partial-call") {
      previewJob = previewJob.then(() => previewToolCall());
      this.transitTo("init", {
        type: "init",
        previewJob,
      });
    } else if (state === "call") {
      const abortController = new AbortController();
      previewJob = previewJob.then(() =>
        previewToolCall(abortController.signal),
      );
      previewJob.then((result) => {
        if (result?.error) {
          logger.debug("Tool call preview rejected:", result.error);
          this.transitTo("pending", {
            type: "complete",
            result,
            reason: "preview-reject",
          });
        } else {
          this.transitTo("pending", { type: "ready", abortController });
        }
      });
      this.transitTo("init", {
        type: "pending",
        previewJob,
        abortController,
      });
    }
  }

  execute(args: unknown, options: { model?: string }) {
    const abortController = new AbortController();
    const abortSignal = ThreadAbortSignal.serialize(abortController.signal);
    let executePromise: Promise<unknown>;

    if (this.toolName === "newTask") {
      executePromise = this.runNewTask(
        args as NewTaskParameterType,
        abortSignal,
        options.model,
      );
    } else {
      executePromise = vscodeHost.executeToolCall(this.toolName, args, {
        toolCallId: this.toolCallId,
        abortSignal,
      });
    }

    const executeJob = executePromise
      .catch((err) => ({
        error: `Failed to execute tool: ${err.message}`,
      }))
      .then((result) => {
        this.onExecuteDone(result);
      });

    this.transitTo("ready", {
      type: "execute",
      executeJob,
      abortController,
    });
  }

  private runNewTask(
    args: NewTaskParameterType,
    abortSignal: ThreadAbortSignalSerialization,
    model?: string,
  ) {
    const uid = args._meta?.uid;
    if (!uid) {
      throw new Error("Missing uid in newTask arguments");
    }
    return vscodeHost.runTask(uid, {
      abortSignal,
      model,
    });
  }

  abort() {
    if (
      this.state.type === "execute" ||
      this.state.type === "execute:streaming"
    ) {
      this.state.abortController.abort();
    }
  }

  reject() {
    const { abortController } = this.checkState("Reject", "ready");
    abortController.abort();
    this.transitTo("ready", {
      type: "complete",
      result: {
        error:
          "User rejected the tool call, please use askFollowupQuestion to clarify next step with user.",
      },
      reason: "user-reject",
    });
  }

  private onExecuteDone(result: ExecuteReturnType) {
    const execute = this.checkState("onExecuteDone", "execute");
    if (
      this.toolName === "executeCommand" &&
      typeof result === "object" &&
      result !== null &&
      "output" in result
    ) {
      this.onExecuteCommand(result as ExecuteCommandReturnType);
    } else if (
      this.toolName === "newTask" &&
      typeof result === "object" &&
      result !== null &&
      "result" in result
    ) {
      this.onExecuteNewTask(result as NewTaskReturnType);
    } else {
      this.transitTo("execute", {
        type: "complete",
        result,
        reason: execute.abortController.signal.aborted
          ? "user-abort"
          : "execute-finish",
      });
    }
  }

  private onExecuteCommand(result: ExecuteCommandReturnType) {
    const signal = threadSignal(result.output);
    const { abortController } = this.checkState("Streaming", "execute");

    let isUserDetached = false;

    const detach = () => {
      isUserDetached = true;
      result.detach();
      abortController.abort();
    };

    this.transitTo("execute", {
      type: "execute:streaming",
      abortController,
      streamingResult: {
        toolName: "executeCommand",
        output: signal.value,
        detach,
      },
    });

    const unsubscribe = signal.subscribe((output) => {
      if (output.status === "completed") {
        const result: Record<string, unknown> = {
          output: output.content,
          isTruncated: output.isTruncated ?? false,
        };
        // do not set error property if it is undefined
        if (output.error) {
          result.error = output.error;
        }
        this.transitTo("execute:streaming", {
          type: "complete",
          result,
          reason: isUserDetached
            ? "user-detach"
            : abortController.signal.aborted
              ? "user-abort"
              : "execute-finish",
        });
        unsubscribe();
      } else {
        this.transitTo("execute:streaming", {
          type: "execute:streaming",
          abortController,
          streamingResult: {
            toolName: "executeCommand",
            output,
            detach,
          },
        });
      }
    });
  }

  private onExecuteNewTask(result: NewTaskReturnType) {
    const signal = threadSignal(result.result);
    const { abortController } = this.checkState("onExecuteNewTask", "execute");
    this.transitTo("execute", {
      type: "execute:streaming",
      abortController,
      streamingResult: {
        toolName: "newTask",
        state: signal.value,
      },
    });

    const unsubscribe = signal.subscribe((runnerState) => {
      if (runnerState.state === "stopped" || runnerState.state === "error") {
        const result =
          runnerState.state === "stopped"
            ? { result: runnerState.result }
            : { error: runnerState.error.message };

        this.transitTo("execute:streaming", {
          type: "complete",
          result,
          reason: abortController.signal.aborted
            ? "user-abort"
            : "execute-finish",
        });
        unsubscribe();
      } else {
        this.transitTo("execute:streaming", {
          type: "execute:streaming",
          abortController,
          streamingResult: {
            toolName: "newTask",
            state: runnerState,
          },
        });
      }
    });
  }

  private checkState<T extends ToolCallState["type"]>(
    op: string,
    expectedState: T,
  ): Extract<ToolCallState, { type: T }> {
    if (this.state.type !== expectedState) {
      throw new Error(
        `[${this.toolName}:${this.toolCallId}] ${op} is not allowed in ${this.state.type}, expects ${expectedState}`,
      );
    }

    return this.state as Extract<ToolCallState, { type: T }>;
  }

  private transitTo(
    expectedState: ToolCallState["type"] | ToolCallState["type"][],
    newState: ToolCallState,
  ): void {
    const expectedStates = Array.isArray(expectedState)
      ? expectedState
      : [expectedState];

    if (!expectedStates.includes(this.state.type)) {
      throw new Error(
        `[${this.toolName}:${this.toolCallId}] failed to transit to ${newState.type}, expects ${expectedState}, but in ${this.state.type}`,
      );
    }

    this.state = newState;

    logger.debug(
      `${this.toolName}:${this.toolCallId} transitioned to ${newState.type}`,
    );
    this.emit(this.state.type, this.state);
  }
}
