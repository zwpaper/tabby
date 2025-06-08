import { vscodeHost } from "@/lib/vscode";
import { ThreadAbortSignal } from "@quilted/threads";
import {
  type ThreadSignalSerialization,
  threadSignal,
} from "@quilted/threads/signals";
import type { ExecuteCommandResult } from "@ragdoll/vscode-webui-bridge";
import type { ToolInvocation } from "ai";
import Emittery from "emittery";

type PreviewReturnType = { error: string } | undefined;
type ExecuteCommandReturnType = {
  output: ThreadSignalSerialization<ExecuteCommandResult>;
  detach: () => void;
};
type ExecuteReturnType = ExecuteCommandReturnType | unknown;

type ToolCallState =
  | {
      type: "init";
      previewJob: Promise<PreviewReturnType>;
    }
  | {
      type: "ready";
    }
  | {
      type: "execute";
      executeJob: Promise<ExecuteReturnType>;
      abortController: AbortController;
    }
  | {
      type: "execute:streaming";
      abortController: AbortController;
      executeCommand: {
        detach: () => void;
        output: ExecuteCommandResult;
      };
    }
  | {
      type: "complete";
      result: unknown;
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
      ? this.state.executeCommand
      : undefined;
  }

  get result() {
    return this.state.type === "complete" ? this.state.result : undefined;
  }

  dispose() {
    this.transitTo("complete", { type: "dispose" });
  }

  preview(args: unknown, state: ToolInvocation["state"]) {
    if (this.status === "ready") {
      vscodeHost.previewToolCall(this.toolName, args, {
        state,
        toolCallId: this.toolCallId,
      });
    } else {
      this.previewInit(args, state);
    }
  }

  private previewInit(args: unknown, state: ToolInvocation["state"]) {
    let { previewJob } = this.checkState("Preview", "init");
    previewJob = previewJob.then(() =>
      vscodeHost.previewToolCall(this.toolName, args, {
        state,
        toolCallId: this.toolCallId,
      }),
    );
    if (state === "call") {
      previewJob.then((result) => {
        // Ignore if call is already previewed.
        if (this.status !== "init") return;

        if (result?.error) {
          this.transitTo("init", { type: "complete", result });
        } else {
          this.transitTo("init", { type: "ready" });
        }
      });
    }

    this.transitTo("init", {
      type: "init",
      previewJob,
    });
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
      .then(this.onExecuteDone.bind(this));

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

  reject(errorText?: string) {
    this.transitTo("ready", {
      type: "complete",
      result: {
        error:
          errorText ||
          "User rejected the tool call, please follow user's instructions for next steps",
      },
    });
  }

  private onExecuteDone(result: ExecuteReturnType) {
    if (
      this.toolName === "executeCommand" &&
      typeof result === "object" &&
      result !== null &&
      "output" in result
    ) {
      this.onExecuteCommand(result as ExecuteCommandReturnType);
    } else {
      this.transitTo("execute", { type: "complete", result });
    }
  }

  private onExecuteCommand(result: ExecuteCommandReturnType) {
    const signal = threadSignal(result.output);

    const { abortController } = this.checkState("Streaming", "execute");
    this.transitTo("execute", {
      type: "execute:streaming",
      abortController,
      executeCommand: {
        output: signal.value,
        detach: result.detach,
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
        });
        unsubscribe();
      } else {
        this.transitTo("execute:streaming", {
          type: "execute:streaming",
          abortController,
          executeCommand: {
            output,
            detach: result.detach,
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
