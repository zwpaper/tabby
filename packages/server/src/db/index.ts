import type { DBMessage } from "@ragdoll/common";
import type { Environment, UserEvent } from "@ragdoll/common";
import { type JSONColumnType, Kysely, PostgresDialect } from "kysely";
import moment from "moment";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import type { ExternalIntegrationVendorData } from "./external-integration";
import type { DB as DbImpl } from "./schema";

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<DbImpl["externalIntegration"], "vendorData"> & {
    vendorData: JSONColumnType<ExternalIntegrationVendorData>;
  };

  task: Omit<
    DbImpl["task"],
    "event" | "conversation" | "environment" | "id"
  > & {
    event: UserEvent | null;
    conversation: { messages: DBMessage[] } | null;
    environment: Environment | null;
  };
};

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool: async () => {
      const conn = parse(process.env.DATABASE_URL || "");
      return new Pool({
        database: conn.database ?? undefined,
        password: conn.password,
        user: conn.user,
        host: conn.host ?? undefined,
        port: Number.parseInt(conn.port ?? "5432", 10),
        ssl: !!conn.ssl,
      });
    },
  }),
});

async function dbMaintainance() {
  // Delete expired sessions.
  const result = await db
    .deleteFrom("session")
    .where("expiresAt", "<", moment().subtract("1", "hour").toDate())
    .executeTakeFirst();
  if (result.numDeletedRows > 0) {
    console.info(`Deleted ${result.numDeletedRows} expired sessions.`);
  }
}

dbMaintainance();
