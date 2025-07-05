import type { ServerWebSocket } from "bun";
import { sql } from "kysely";
import { db, uidCoder } from "../db";

const TaskLockRefreshInterval = 5 * 60 * 1000; // 5 minutes

export class TaskLockService {
  private locks = new Map<
    string, // uid
    {
      userId: string;
      lockId: string;
      ws: ServerWebSocket;
      release: () => Promise<void>;
    }
  >();

  async lockTask(
    uid: string,
    userId: string,
    lockId: string,
    ws: ServerWebSocket,
  ) {
    const taskId = uidCoder.decode(uid);

    const lock = async () => {
      const lockResult = await db
        .insertInto("taskLock")
        .values({
          id: lockId,
          taskId,
        })
        .onConflict((oc) =>
          oc
            .column("taskId")
            .doUpdateSet({
              updatedAt: sql`CURRENT_TIMESTAMP`,
            })
            .where("taskLock.id", "=", lockId),
        )
        .executeTakeFirst();

      if (!lockResult.numInsertedOrUpdatedRows) {
        throw new Error("Task is locked by another session");
      }
    };

    const refreshLockTimer = setInterval(async () => {
      await lock();
    }, TaskLockRefreshInterval);
    await lock();

    const release = async () => {
      if (refreshLockTimer) {
        clearInterval(refreshLockTimer);
      }

      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }

      await db
        .deleteFrom("taskLock")
        .where("id", "=", lockId)
        .where("taskId", "in", (eb) =>
          eb
            .selectFrom("task as t")
            .select("t.id")
            .where("t.id", "=", taskId)
            .where("t.userId", "=", userId),
        )
        .executeTakeFirst();
    };

    this.locks.set(uid, {
      userId,
      lockId,
      ws,
      release,
    });
  }

  async unlockTask(uid: string, userId: string, lockId: string) {
    const lock = this.locks.get(uid);
    if (!lock || lock.userId !== userId || lock.lockId !== lockId) {
      console.error("Lock not found or not matched");
      return;
    }

    this.locks.delete(uid);
    await lock.release();
  }

  async gracefulShutdown() {
    const taskLocksToRelease = Array.from(this.locks.values());
    this.locks.clear();

    console.info(
      `Process exiting, cleaning up ${taskLocksToRelease.length} task locks`,
    );
    const promises = [];
    for (const task of taskLocksToRelease) {
      promises.push(task.release());
    }
    await Promise.all(promises);
  }
}

export const taskLockService = new TaskLockService();
