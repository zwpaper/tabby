import { vscodeHost } from "@/lib/vscode";
import { ThreadAbortSignal } from "@quilted/threads";
import {
  type ThreadSignalSerialization,
  threadSignal,
} from "@quilted/threads/signals";
import type {
  ExecuteCommandResult,
  TaskRunnerState,
} from "@ragdoll/vscode-webui-bridge";
import type { ToolInvocation } from "ai";
import Emittery from "emittery";

type PreviewReturnType = { error: string } | undefined;
type ExecuteCommandReturnType = {
  output: ThreadSignalSerialization<ExecuteCommandResult>;
  detach: () => void;
};
type ExecuteReturnType = ExecuteCommandReturnType | unknown;

type NewTaskReturnType = {
  result: ThreadSignalSerialization<{ [taskUid: string]: TaskRunnerState }>;
};

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
      streamingResult:
        | {
            toolName: "executeCommand";
            detach: () => void;
            output: ExecuteCommandResult;
          }
        | {
            toolName: "newTask";
            result: TaskRunnerState;
          };
    }
  | {
      type: "complete";
      result: unknown;
      reason:
        | "execute-finish"
        | "user-reject"
        | "preview-reject"
        | "user-detach"
        | "user-abort";
    }
  | {
      type: "dispose";
    };

type ToolCallLifeCycleEvents = {
  [K in ToolCallState["type"]]: Extract<ToolCallState, { type: K }>;
};

export class ToolCallLifeCycle extends Emittery<ToolCallLifeCycleEvents> {
  private state: ToolCallState = {
    type: "init",
    previewJob: Promise.resolve(undefined),
  };

  constructor(
    private readonly toolName: string,
    readonly toolCallId: string,
  ) {
    super();
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

  execute(args: unknown) {
    const abortController = new AbortController();
    const executeJob = vscodeHost
      .executeToolCall(this.toolName, args, {
        toolCallId: this.toolCallId,
        abortSignal: ThreadAbortSignal.serialize(abortController.signal),
      })
      .catch((err) => ({
        error: `Failed to execute tool: ${err.message}`,
      }))
      .then((result) => this.onExecuteDone(result, args));

    this.transitTo("ready", {
      type: "execute",
      executeJob,
      abortController,
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

  private onExecuteDone(result: ExecuteReturnType, args: unknown) {
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
      this.onExecuteNewTask(result as NewTaskReturnType, args);
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

  private onExecuteNewTask(result: NewTaskReturnType, args: unknown) {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    const uid = (args as any)?._meta?.uid;
    if (!uid) {
      throw new Error(
        `[${this.toolName}:${this.toolCallId}] newTask requires a valid UID in args._meta.uid`,
      );
    }
    const signal = threadSignal(result.result);
    const { abortController } = this.checkState("onExecuteNewTask", "execute");
    this.transitTo("execute", {
      type: "execute:streaming",
      abortController,
      streamingResult: {
        toolName: "newTask",
        result: signal.value[uid] ?? {
          status: "running",
        },
      },
    });

    const unsubscribe = signal.subscribe((status) => {
      const state = status[uid];
      if (state?.status === "stopped") {
        const result: { result?: string; error?: string } = {};
        if (state.progress?.type === "runner-stopped") {
          result.result = state.progress.result;
          if (state.progress.error) {
            result.error = `Task runner stopped: ${state.progress.error}`;
          }
        }

        if (state.error) {
          result.error = `Run Task Failed: ${state.error}`;
        }
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
            result: state,
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

    this.emit(this.state.type, this.state);
  }
}
