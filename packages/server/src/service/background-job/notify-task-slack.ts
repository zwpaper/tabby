import { Queue, Worker } from "bullmq";
import { slackTaskService } from "../slack-task";
import { getJobLogger } from "./logger";
import { queueConfig } from "./redis";

const QueueName = "notify-task-slack";

interface NotifyTaskSlack {
  userId: string;
  uid: string;
}

function dedupeId(job: NotifyTaskSlack) {
  return `notify-task-slack:${job.userId}-${job.uid}`;
}

export const queue = new Queue<NotifyTaskSlack>(QueueName, queueConfig);

export async function enqueueNotifyTaskSlack(data: NotifyTaskSlack) {
  await queue.add(QueueName, data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    deduplication: {
      id: dedupeId(data),
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 10, // 10 days
    },
    removeOnComplete: {
      age: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export function createNotifyTaskSlackWorker() {
  return new Worker<NotifyTaskSlack>(
    QueueName,
    async (job) => {
      const logger = getJobLogger(job);
      try {
        const result = await slackTaskService.notifyTaskStatusUpdate(
          job.data.userId,
          job.data.uid,
        );
        if (result) {
          logger.info(`Successfully notified task status update: ${result}`);
        }
      } catch (error) {
        logger.error(
          `Failed to notify task status update: ${error instanceof Error ? error.message : error}`,
        );
        throw error;
      }
    },
    {
      ...queueConfig,
      // FIXME(jackson): tune slack rate limits
      limiter: {
        max: 60,
        duration: 1000 * 60,
      },
    },
  );
}
