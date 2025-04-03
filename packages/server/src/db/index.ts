import { Kysely } from "kysely";
import { NeonDialect } from "kysely-neon";
import ws from "ws";
import type { DB } from "./schema";

export const db = new Kysely<DB>({
  dialect: new NeonDialect({
    connectionString: process.env.DATABASE_URL,
    webSocketConstructor: ws,
  }),
});
