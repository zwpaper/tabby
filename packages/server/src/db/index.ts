import type { DB, TaskCreateEvent } from "@ragdoll/db";
import { Kysely, PostgresDialect } from "kysely";
import moment from "moment";
import { Pool } from "pg";
import { parse } from "pg-connection-string";
import { publishTaskEvent } from "../server";
import { slackTaskService } from "../service/slack-task";
import { uidCoder } from "./id-coders";

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
  eventType: TaskCreateEvent["type"] | null;
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
      const { userId, id, status, eventType } = JSON.parse(
        msg.payload,
      ) as TaskStatusChanged;

      const uid = uidCoder.encode(id);
      slackTaskService.enqueueNotifyTaskSlack({
        userId,
        uid,
        eventType,
      });

      publishTaskEvent(userId, {
        type: "task:status-changed",
        data: {
          uid,
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

export { minionIdCoder, uidCoder } from "./id-coders";
