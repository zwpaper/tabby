import { Queue, Worker } from "bullmq";
import { getSandboxProvider } from "../sandbox";
import { getJobLogger } from "./logger";
import { queueConfig } from "./redis";

const QueueName = "pause-inactive-sandbox";
const sandboxProvider = getSandboxProvider();

interface PauseInactiveSandboxData {
  sandboxId: string;
}

export const queue = new Queue<PauseInactiveSandboxData>(
  QueueName,
  queueConfig,
);

export async function signalKeepAliveSandbox(data: PauseInactiveSandboxData) {
  const jobId = `pause-sandbox:${data.sandboxId}`;
  await queue.remove(jobId);
  queue.add(QueueName, data, {
    delay: 60 * 1000 * 10, // 10 minutes
    jobId,
    attempts: 1,
    removeOnComplete: {
      age: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export function createPauseInactiveSandboxWorker() {
  init();

  return new Worker<PauseInactiveSandboxData>(
    QueueName,
    async (job) => {
      const logger = getJobLogger(job);
      const { sandboxId } = job.data;
      logger.debug(`Pausing sandbox ${sandboxId}`);
      try {
        const status = await sandboxProvider.connect(sandboxId);
        if (status.isRunning) {
          await sandboxProvider.pause(sandboxId);
          logger.debug(`Sandbox ${sandboxId} paused`);
        }
      } catch (error) {
        logger.debug(`Failed to pause sandbox ${sandboxId}`, error);
      }
    },
    queueConfig,
  );
}

async function init() {
  const sandboxes = await sandboxProvider.list();
  for (const sandbox of sandboxes) {
    signalKeepAliveSandbox({ sandboxId: sandbox.sandboxId });
  }
}
