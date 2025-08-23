import { type Environment, formatters, getLogger } from "@getpochi/common";
import type { PochiApiClient } from "@getpochi/common/pochi-api";
import type { Store } from "@livestore/livestore";
import { makeTaskQuery } from "../livestore/queries";
import { events, tables } from "../livestore/schema";
import { toTaskStatus } from "../task";
import type { Message } from "../types";

const logger = getLogger("PersistManager");

interface PersistJob {
  taskId: string;
  store: Store;
  messages: Message[];
  apiClient: PochiApiClient;
  environment?: Environment;
  waitUntil?: (promise: Promise<unknown>) => void;
}

class PersistManager {
  private jobs = Promise.resolve();
  private pendingJobs = new Map<string, PersistJob>();

  push(job: PersistJob) {
    // Replace any existing pending job with the same taskId
    this.pendingJobs.set(job.taskId, job);

    this.jobs = this.jobs.then(() => {
      // Get the next job to process (one at a time)
      const nextJob = this.pendingJobs.values().next().value;
      if (!nextJob) {
        return Promise.resolve();
      }

      // Remove the job from pending map
      this.pendingJobs.delete(nextJob.taskId);

      // Process the single job
      return this.process(nextJob).catch((error) => {
        logger.error("Failed to persist chat", error);
      });
    });

    job.waitUntil?.(this.jobs);
  }

  private async process({
    taskId,
    store,
    messages,
    apiClient,
    environment,
  }: PersistJob) {
    const lastMessage = messages.at(-1);
    if (!lastMessage) {
      throw new Error("No messages to persist");
    }
    const { parentId } = store.query(makeTaskQuery(taskId)) || {};
    const finishReason =
      lastMessage.metadata?.kind === "assistant"
        ? lastMessage.metadata.finishReason
        : undefined;
    const resp = await apiClient.api.chat.persist.$post({
      json: {
        id: taskId,
        messages: formatters.storage(messages),
        environment,
        status: toTaskStatus(lastMessage, finishReason),
        parentClientTaskId: parentId ?? undefined,
      },
    });

    if (resp.status !== 200) {
      throw new Error(`Failed to persist chat: ${resp.statusText}`);
    }

    const { shareId } = (await resp.json()) as { shareId: string };
    const existingShareId = store.query(
      tables.tasks
        .select("shareId")
        .where("id", "=", taskId)
        .first({ fallback: () => null }),
    );
    if (!existingShareId) {
      store.commit(
        events.updateShareId({
          id: taskId,
          shareId,
          updatedAt: new Date(),
        }),
      );
    }
  }
}

export const persistManager = new PersistManager();
