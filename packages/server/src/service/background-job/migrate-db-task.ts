import { getLogger } from "@ragdoll/common";
import type { DBMessage } from "@ragdoll/db";
import { fromDBMessage } from "@ragdoll/livekit/v4-adapter";
import { Queue, Worker } from "bullmq";
import { sql } from "kysely";
import { queueConfig } from "./redis";

import { db } from "../../db";

const logger = getLogger("migrateDBTask");

// FIXME(wei): after migrate all tasks, should delete this job
const QueueName = "migrate-db-task";
export const queue = new Queue(QueueName, queueConfig);

interface Conversation {
  messages: DBMessage[];
  messagesNext?: unknown[];
}

export async function migrateDBTask() {
  const tasks = await db
    .selectFrom("task")
    .select(["id", "conversation"])
    .where(sql<boolean>`jsonb_array_length(conversation->'messages') > 0`)
    .where(
      sql<boolean>`(NOT(conversation ? 'messagesNext') OR jsonb_array_length(conversation->'messagesNext') = 0)`,
    )
    .limit(100)
    .execute();

  if (tasks.length === 0) {
    logger.debug("No tasks found to migrate conversation messages.");
    return;
  }

  logger.debug(`[migrateDBTask] Found ${tasks.length} tasks to migrate.`);

  const promises = tasks.map(async (task) => {
    if (!task.id || !task.conversation) {
      return;
    }

    const conversation = task.conversation as Conversation;
    const messages = conversation.messages;

    if (!messages || messages.length === 0) {
      return;
    }

    const messagesNext = messages.map(fromDBMessage);

    const newConversation = {
      ...conversation,
      messages,
      messagesNext,
    };

    await db
      .updateTable("task")
      .set({
        conversation: newConversation,
      })
      .where("id", "=", task.id)
      .execute();
  });

  await Promise.all(promises);

  logger.debug(`[migrateDBTask] Migrated ${tasks.length} tasks successfully.`);
}

await queue.upsertJobScheduler(
  "every-10-minutes",
  {
    pattern: "*/10 * * * *",
  },
  {
    opts: {
      removeOnComplete: {
        age: 60 * 60 * 24 * 1, // 1 day
      },
      removeOnFail: {
        age: 60 * 60 * 24 * 7, // 7 day
      },
    },
  },
);

export async function createMigrateDBTaskWorker() {
  return new Worker(
    QueueName,
    async () => {
      try {
        await migrateDBTask();
      } catch (error) {
        logger.error({ error }, "Error migrating conversation messages.");
        throw error;
      }
    },
    queueConfig,
  );
}
