import type { DBMessage, Environment, UserEvent } from "@ragdoll/common";
import type { Generated, JSONColumnType } from "kysely";
import type { ExternalIntegrationVendorData } from "./external-integration";
import type { DB as DbImpl } from "./schema";

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<DbImpl["externalIntegration"], "vendorData"> & {
    vendorData: JSONColumnType<ExternalIntegrationVendorData>;
  };

  task: Omit<
    DbImpl["task"],
    "event" | "conversation" | "environment" | "id" | "status"
  > & {
    event: UserEvent | null;
    conversation: { messages: DBMessage[] } | null;
    environment: Environment | null;
    status: Generated<
      | "completed"
      | "failed"
      | "streaming"
      | "pending-input"
      | "pending-tool"
      | "pending-model"
    >;
  };
};
