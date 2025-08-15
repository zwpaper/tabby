import type { Environment } from "@ragdoll/common";
import type { Message } from "@ragdoll/livekit";
import type { ColumnType, Generated, JSONColumnType } from "kysely";
import type { ExternalIntegrationVendorData } from "./external-integration";
import type { DB as DbImpl } from "./schema";
import type { DBMessage, TaskCreateEvent, TaskError } from "./types";

export type DB = Omit<DbImpl, "externalIntegration" | "task" | "clip"> & {
  externalIntegration: Omit<DbImpl["externalIntegration"], "vendorData"> & {
    vendorData: JSONColumnType<ExternalIntegrationVendorData>;
  };

  task: Omit<
    DbImpl["task"],
    "event" | "conversation" | "environment" | "status" | "error" | "taskId"
  > & {
    event: TaskCreateEvent | null;
    conversation: {
      messagesNext: Message[];
    } | null;
    environment: Environment | null;
    status: Generated<
      // Task has finished and ends with attemptCompletion tool call.
      | "completed"
      // Task has finished.
      | "pending-input"
      // Task has failed.
      | "failed"
      // Task is running model.
      | "streaming"
      // Task is waiting for a tool to run.
      | "pending-tool"
      // Task is waiting for a model to run.
      | "pending-model"
    >;
    error: TaskError | null;

    // Make taskId writeable only for refactoring.
    taskId: ColumnType<never, number, never>;
  };

  clip: Omit<DbImpl["clip"], "data"> & {
    data: ClipData;
  };
};

export type ClipData = {
  messages: DBMessage[] | null;
  assistant?: "claude-code" | "open-coder" | "gemini-cli";
};

export type {
  DBMessage,
  ExtendedUIMessage,
  CheckpointPart,
  TaskError,
  TaskCreateEvent,
  TaskEvent,
  ExternalIntegrationsEvent,
} from "./types";

export type TaskCreateEventDataHelper<T extends TaskCreateEvent["type"]> =
  Extract<TaskCreateEvent, { type: T }>["data"];
