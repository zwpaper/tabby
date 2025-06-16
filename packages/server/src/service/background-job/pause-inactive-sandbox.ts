import { Sandbox } from "@e2b/code-interpreter";
import { getLogger } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { queueConfig } from "./redis";

const logger = getLogger("PauseInactiveSandbox");

const QueueName = "pause-inactive-sandbox";

interface PauseInactiveSandboxData {
  sandboxId: string;
}

const queue = new Queue<PauseInactiveSandboxData>(QueueName, queueConfig);

export async function signalKeepAliveSandbox(data: PauseInactiveSandboxData) {
  const jobId = `pause-sandbox:${data.sandboxId}`;
  await queue.remove(jobId);
  queue.add(QueueName, data, {
    delay: 60 * 1000 * 10, // 10 minutes
    jobId,
    attempts: 1,
  });
}

export function createPauseInactiveSandboxWorker() {
  return new Worker<PauseInactiveSandboxData>(
    QueueName,
    async (job) => {
      const { sandboxId } = job.data;
      logger.info(`Pausing sandbox ${sandboxId}`);
      try {
        const sandbox = await Sandbox.connect(sandboxId);
        await sandbox.pause();
        logger.info(`Sandbox ${sandboxId} paused`);
      } catch (error) {
        logger.error(`Failed to pause sandbox ${sandboxId}`, error);
        throw error;
      }
    },
    queueConfig,
  );
}
