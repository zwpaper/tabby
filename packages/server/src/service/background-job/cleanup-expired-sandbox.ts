import { Queue, Worker } from "bullmq";
import { db } from "../../db";
import { sandboxService } from "../sandbox";
import { getJobLogger } from "./logger";
import { queueConfig } from "./redis";

const QueueName = "cleanup-expired-sandbox";

// 7 days in milliseconds
const SANDBOX_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000;

interface CleanupExpiredSandboxData {
  sandboxId: string;
}

export const queue = new Queue<CleanupExpiredSandboxData>(
  QueueName,
  queueConfig,
);

export async function scheduleCleanupExpiredSandbox(
  data: CleanupExpiredSandboxData,
) {
  const minion = await db
    .selectFrom("minion")
    .select("createdAt")
    .where("sandboxId", "=", data.sandboxId)
    .executeTakeFirst();
  const delay = minion
    ? (() => {
        // Calculate delay based on when the sandbox should expire
        const now = new Date();
        const expiryTime = new Date(
          minion.createdAt.getTime() + SANDBOX_EXPIRY_TIME,
        );
        return Math.max(0, expiryTime.getTime() - now.getTime());
      })()
    : 0;

  const jobId = `cleanup-sandbox:${data.sandboxId}`;
  await queue.remove(jobId);
  await queue.add(QueueName, data, {
    delay,
    jobId,
    attempts: 3,
    removeOnComplete: {
      age: 60 * 60 * 24 * 10, // 10 days
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export function createCleanupSandboxWorker() {
  init();

  return new Worker<CleanupExpiredSandboxData>(
    QueueName,
    async (job) => {
      const logger = getJobLogger(job);

      const { sandboxId } = job.data;
      logger.debug(`Cleaning up sandbox ${sandboxId}`);

      try {
        // Check if minion still exists and is not already deleted
        const minion = await db
          .selectFrom("minion")
          .selectAll()
          .where("sandboxId", "=", sandboxId)
          .where((eb) =>
            eb.and([eb("url", "is not", null), eb("url", "!=", "")]),
          )
          .executeTakeFirst();

        if (minion) {
          // Check if sandbox is older than 7 days
          const createdAt = new Date(minion.createdAt);
          const now = new Date();
          const ageInMs = now.getTime() - createdAt.getTime();

          if (ageInMs < SANDBOX_EXPIRY_TIME) {
            logger.debug(
              `Sandbox ${sandboxId} is not old enough for cleanup (${ageInMs}ms < ${SANDBOX_EXPIRY_TIME}ms), skipping`,
            );
            return;
          }
        }

        // Delete the sandbox
        await sandboxService.delete(sandboxId);
        logger.debug(`Sandbox ${sandboxId} deleted`);

        // Update minion status to deleted
        if (minion) {
          await db
            .updateTable("minion")
            .where("id", "=", minion.id)
            .set({
              url: undefined,
              updatedAt: new Date(),
            })
            .execute();
          logger.debug(`Minion ${minion.id} status updated to deleted`);
        }
      } catch (error) {
        logger.error(`Failed to cleanup expired sandbox ${sandboxId}:`, error);
        throw error;
      }
    },
    queueConfig,
  );
}

async function init() {
  // Schedule cleanup for all existing sandboxes that are not already deleted
  const minions = await db
    .selectFrom("minion")
    .select(["sandboxId", "createdAt"])
    .where("sandboxId", "is not", null)
    .where((eb) => eb.and([eb("url", "is not", null), eb("url", "!=", "")]))
    .execute();

  for (const minion of minions) {
    if (minion.sandboxId) {
      await scheduleCleanupExpiredSandbox({
        sandboxId: minion.sandboxId,
      });
    }
  }

  await checkSandboxes();
}

async function checkSandboxes() {
  try {
    // Get all sandboxes from the provider
    const allSandboxes = await sandboxService.list();

    for (const sandbox of allSandboxes) {
      if (sandbox) {
        await scheduleCleanupExpiredSandbox({
          sandboxId: sandbox.sandboxId,
        });
      }
    }
  } catch (error) {
    console.error("Failed to cleanup orphaned sandboxes:", error);
  }
}
