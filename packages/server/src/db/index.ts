import type { Message as AiMessage } from "ai";
import {
  type ColumnType,
  type JSONColumnType,
  Kysely,
  PostgresDialect,
} from "kysely";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import type { Environment } from "../types";
import type { UserEvent } from "./event";
import type { ExternalIntegrationSlack } from "./external-integration";
import type { DB as DbImpl, Generated } from "./schema";

export type { UserEvent };

export type Message = Omit<AiMessage, "createdAt"> & {
  createdAt?: string;
};

export type DB = Omit<DbImpl, "externalIntegration" | "task"> & {
  externalIntegration: Omit<
    DbImpl["externalIntegration"],
    "provider" | "payload"
  > &
    ExternalIntegrationSlack;

  task: Omit<DbImpl["task"], "event" | "messages" | "environment"> & {
    event: UserEvent | null;
    messages: Generated<JSONColumnType<Message[]>>;
    environment: ColumnType<
      Environment | null,
      Environment | null,
      Environment
    >;
  };
};

export function toAiMessage(
  message: Omit<Message, "createdAt"> & { createdAt?: Date | string },
): AiMessage {
  return {
    ...message,
    createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
  };
}

export function toAiMessages(
  messages: Array<Omit<Message, "createdAt"> & { createdAt?: Date | string }>,
): AiMessage[] {
  return messages.map(toAiMessage);
}

export function fromAiMessage(message: AiMessage): Message {
  return {
    ...message,
    createdAt: message.createdAt?.toISOString(),
  };
}

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
