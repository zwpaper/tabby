import type { Installation } from "@slack/bolt";
import type { JSONColumnType } from "kysely";

export interface ExternalIntegrationSlack {
  provider: "slack";
  payload: JSONColumnType<Installation<"v2", boolean>>;
}
