import type { DB, TaskCreateEvent } from "@ragdoll/db";
import { slackTaskService } from "../service/slack-task";
import { taskEvents } from "../service/task-events";
import { uidCoder } from "./id-coders";
import { pool } from "./pool";

type TaskStatusChanged = {
  id: number;
  status: DB["task"]["status"]["__select__"];
  userId: string;
  eventType: TaskCreateEvent["type"] | null;
};

export async function startListenDBEvents() {
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

      taskEvents.publish({
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
