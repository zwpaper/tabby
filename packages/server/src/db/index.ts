import type { Message } from "ai";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import type { Environment } from "../types";
import type { UserEvent } from "./event";
import type { ExternalIntegrationSlack } from "./external-integration";
import type { DB as DbImpl } from "./schema";

export type { UserEvent };

export type DBMessage = {
  id: string;
  createdAt?: string;
  role: Message["role"];
  parts?: Message["parts"];
};

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<
    DbImpl["externalIntegration"],
    "provider" | "payload"
  > &
    ExternalIntegrationSlack;

  task: Omit<DbImpl["task"], "event" | "conversation" | "environment"> & {
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
