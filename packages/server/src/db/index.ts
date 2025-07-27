import { getLogger } from "@ragdoll/common";
import type { DB } from "@ragdoll/db";
import { Kysely, PostgresDialect } from "kysely";
import moment from "moment";
import { Pool } from "pg";
import { parse } from "pg-connection-string";

const logger = getLogger("DB");

const pool = (() => {
  const conn = parse(process.env.DATABASE_URL || "");
  return new Pool({
    database: conn.database ?? undefined,
    password: conn.password,
    user: conn.user,
    host: conn.host ?? undefined,
    port: Number.parseInt(conn.port ?? "5432", 10),
    ssl: !!conn.ssl,
  });
})();

export const db = new Kysely<DB>({
  dialect: new PostgresDialect({
    pool,
  }),
});

async function dbMaintainance() {
  // Delete expired sessions.
  const result = await db
    .deleteFrom("session")
    .where("expiresAt", "<", moment().subtract("7", "day").toDate())
    .executeTakeFirst();
  if (result.numDeletedRows > 0) {
    logger.info(`Deleted ${result.numDeletedRows} expired sessions.`);
  }
}

dbMaintainance();

export { clipIdCoder, minionIdCoder, uidCoder } from "./id-coders";
