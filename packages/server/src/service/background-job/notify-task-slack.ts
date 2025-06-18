import { Queue, Worker } from "bullmq";
import { slackTaskService } from "../slack-task";
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

export function enqueueNotifyTaskSlack(data: NotifyTaskSlack) {
  queue.add(QueueName, data, {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    deduplication: {
      id: dedupeId(data),
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
      await slackTaskService.notifyTaskStatusUpdate(
        job.data.userId,
        job.data.uid,
        false,
      );
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
