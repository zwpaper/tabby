import path from "node:path";
import { SandboxPath } from "@ragdoll/common";
import { Queue, Worker } from "bullmq";
import { db, minionIdCoder } from "../../db";
import { type CreateSandboxOptions, sandboxService } from "../sandbox";
import { scheduleCleanupExpiredSandbox, signalKeepAliveSandbox } from "./index";
import { getJobLogger } from "./logger";
import { queueConfig } from "./redis";

const QueueName = "create-sandbox";

const MinionDomain = process.env.POCHI_MINION_DOMAIN || "runpochi.com";

interface CreateSandboxJobData {
  minionId: string;
  sandboxId: string;
  uid: string;
  envs: Record<string, string>;
  githubRepository?: {
    owner: string;
    repo: string;
  };
}

export const queue = new Queue<CreateSandboxJobData>(QueueName, queueConfig);

export async function scheduleCreateSandbox(data: CreateSandboxJobData) {
  const jobId = `create-sandbox:${data.minionId}`;
  await queue.remove(jobId);
  await queue.add(QueueName, data, {
    jobId,
    attempts: 3,
    removeOnComplete: {
      age: 60 * 60 * 24, // 1 day
    },
    removeOnFail: {
      age: 60 * 60 * 24 * 7, // 7 days
    },
  });
}

export function createSandboxWorker() {
  return new Worker<CreateSandboxJobData>(
    QueueName,
    async (job) => {
      const logger = getJobLogger(job);
      const { minionId, sandboxId, uid, envs, githubRepository } = job.data;

      logger.debug(`Creating sandbox for minion ${minionId}`);

      try {
        // Check if minion still exists and doesn't already have a sandbox
        const minion = await db
          .selectFrom("minion")
          .selectAll()
          .where("id", "=", minionIdCoder.decode(minionId))
          .executeTakeFirst();

        if (!minion) {
          logger.error(`Minion ${minionId} not found`);
          throw new Error(`Minion ${minionId} not found`);
        }

        if (minion.sandboxId) {
          logger.debug(
            `Minion ${minionId} already has sandbox ${minion.sandboxId}`,
          );
          return;
        }

        // Create sandbox
        const opts: CreateSandboxOptions = {
          id: sandboxId,
          uid,
          envs,
        };
        const sandbox = await sandboxService.create(opts);
        logger.debug(`Sandbox ${sandbox.id} created for minion ${minionId}`);

        // Build the URL
        const url = new URL(`https://${sandboxId}.${MinionDomain}`);

        if (uid) {
          url.searchParams.append(
            "callback",
            encodeURIComponent(
              JSON.stringify({
                authority: "tabbyml.pochi",
                query: `task=${uid}`,
              }),
            ),
          );
        }

        const projectDir = githubRepository
          ? path.join(SandboxPath.home, githubRepository.repo)
          : SandboxPath.project;
        let urlString = url.toString();
        if (url.search) {
          urlString += `&folder=${projectDir}`;
        } else {
          urlString += `?folder=${projectDir}`;
        }

        // Update the minion with the sandbox ID and URL
        await db
          .updateTable("minion")
          .where("id", "=", minionIdCoder.decode(minionId))
          .set({
            sandboxId: sandbox.id,
            url: urlString,
            updatedAt: new Date(),
          })
          .execute();

        logger.debug(`Minion ${minionId} updated with sandbox details`);

        // Signal keep alive for the sandbox
        signalKeepAliveSandbox({ sandboxId: sandbox.id });

        // Schedule cleanup of the sandbox after 7 days
        await scheduleCleanupExpiredSandbox({
          sandboxId: sandbox.id,
        });

        logger.debug(`Sandbox creation completed for minion ${minionId}`);
      } catch (error) {
        logger.error(`Failed to create sandbox for minion ${minionId}:`, error);

        // Update minion to indicate failure
        await db
          .updateTable("minion")
          .where("id", "=", minionIdCoder.decode(minionId))
          .set({
            updatedAt: new Date(),
          })
          .execute();

        throw error;
      }
    },
    queueConfig,
  );
}
