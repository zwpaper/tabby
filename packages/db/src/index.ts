import type { ColumnType, Generated, JSONColumnType } from "kysely";
import type { Environment } from "./environment";
import type { ExternalIntegrationVendorData } from "./external-integration";
import type { DB as DbImpl } from "./schema";
import type { DBMessage, TaskError, UserEvent } from "./types";

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<DbImpl["externalIntegration"], "vendorData"> & {
    vendorData: JSONColumnType<ExternalIntegrationVendorData>;
  };

  task: Omit<
    DbImpl["task"],
    "event" | "conversation" | "environment" | "status" | "error" | "taskId"
  > & {
    event: UserEvent | null;
    conversation: { messages: DBMessage[] } | null;
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
};

export type { DBMessage, TaskError, UserEvent, TaskEvent } from "./types";
export {
  ZodEnvironment,
  type Environment,
  type GitStatus,
} from "./environment";
export { type Todo, ZodTodo } from "./todo";

export type UserEventDataHelper<T extends UserEvent["type"]> = Extract<
  UserEvent,
  { type: T }
>["data"];
