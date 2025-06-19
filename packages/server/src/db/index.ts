import type { DB } from "@ragdoll/db";
import { Kysely, PostgresDialect } from "kysely";
import moment from "moment";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import { publishTaskEvent } from "../server";
import { enqueueNotifyTaskSlack } from "../service/background-job";
import { idCoders } from "./id-coders";

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

type TaskStatusChanged = {
  id: number;
  status: DB["task"]["status"]["__select__"];
  userId: string;
};

export async function startListenDBEvents() {
  await dbMaintainance();

  const client = await pool.connect();
  await client.query("LISTEN task_status_channel");

  client.on("notification", (msg) => {
    if (msg.channel === "task_status_channel") {
      if (!msg.payload) {
        console.warn("No payload in task_status_channel");
        return;
      }
      const { userId, id, status } = JSON.parse(
        msg.payload,
      ) as TaskStatusChanged;

      const uid = idCoders.uid.encode(id);
      enqueueNotifyTaskSlack({
        userId,
        uid,
      });

      publishTaskEvent(userId, {
        type: "task:status-changed",
        data: {
          uid: idCoders.uid.encode(id),
          status,
        },
      });
    }
  });

  console.log("Listening for DB notifications...");
}

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

export { idCoders } from "./id-coders";
