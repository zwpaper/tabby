import type {
  DBMessage,
  Environment,
  TaskError,
  UserEvent,
} from "@ragdoll/common";
import type { Generated, JSONColumnType } from "kysely";
import type { ExternalIntegrationVendorData } from "./external-integration";
import type { DB as DbImpl } from "./schema";

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<DbImpl["externalIntegration"], "vendorData"> & {
    vendorData: JSONColumnType<ExternalIntegrationVendorData>;
  };

  task: Omit<
    DbImpl["task"],
    "event" | "conversation" | "environment" | "id" | "status" | "error"
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
  };
};
