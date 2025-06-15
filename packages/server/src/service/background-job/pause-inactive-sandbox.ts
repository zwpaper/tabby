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

export function enqueuePauseInactiveSandbox(data: PauseInactiveSandboxData) {
  queue.add(QueueName, data, {
    delay: 60 * 1000 * 10, // 10 minutes
    attempts: 1,
    jobId: `pause-sandbox:${data.sandboxId}`,
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
