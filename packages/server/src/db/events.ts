import { getLogger } from "@ragdoll/common";
import type { DB, TaskCreateEvent } from "@ragdoll/db";
import { slackTaskService } from "../service/slack-task";
import { taskEvents } from "../service/task-events";
import { uidCoder } from "./id-coders";
import { pool } from "./pool";

const logger = getLogger("DBEvents");

type TaskStatusChanged = {
  id: number;
  status: DB["task"]["status"]["__select__"];
  userId: string;
  eventType: TaskCreateEvent["type"] | null;
};

import { userIntegrationsEvents } from "../service/user-integrations-events";

export async function startListenDBEvents() {
  const client = await pool.connect();
  await client.query("LISTEN task_status_channel");
  await client.query("LISTEN integrations_changed");

  client.on("notification", (msg) => {
    if (msg.channel === "task_status_channel") {
      if (!msg.payload) {
        logger.warn("No payload in task_status_channel");
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
    } else if (msg.channel === "integrations_changed") {
      if (!msg.payload) {
        logger.warn("No payload in integrations_changed");
        return;
      }
      const payload = JSON.parse(msg.payload) as { userId: string };
      if (payload?.userId) {
        userIntegrationsEvents.publish({
          type: "integrations:changed",
          data: { userId: payload.userId },
        });
      }
    }
  });

  logger.info("Listening for DB notifications...");
}
