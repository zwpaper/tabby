import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import { db, uidCoder } from "../db";

class TaskLock {
  private refCount = 0;

  constructor(
    private readonly taskId: number,
    private readonly userId: string,
    private readonly lockId: string,
  ) {}

  async checkLock(userId: string, lockId: string) {
    if (this.userId !== userId) {
      throw new Error("User ID does not match");
    }

    if (this.lockId !== lockId) {
      throw new Error("Lock ID does not match");
    }

    await this.lock();
  }

  private async lock() {
    const lockResult = await db
      .insertInto("taskLock")
      .values({
        id: this.lockId,
        taskId: this.taskId,
      })
      .onConflict((oc) =>
        oc
          .column("taskId")
          .doUpdateSet({
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where("taskLock.id", "=", this.lockId)
          .where(({ exists, selectFrom }) =>
            exists(
              selectFrom("task")
                .select("id")
                .where("id", "=", this.taskId)
                .where("userId", "=", this.userId),
            ),
          ),
      )
      .executeTakeFirst();

    if (!lockResult.numInsertedOrUpdatedRows) {
      // Task exists, so it must be a lock conflict.
      throw new HTTPException(423, {
        message: "Task is locked by other session",
      });
    }
  }

  retain() {
    this.refCount++;
  }

  async release(force = false): Promise<boolean> {
    this.refCount--;
    if (this.refCount === 0 || force) {
      await this.dispose();
      return true;
    }
    return false;
  }

  private async dispose() {
    await db
      .deleteFrom("taskLock")
      .where("id", "=", this.lockId)
      .where("taskId", "in", (eb) =>
        eb
          .selectFrom("task as t")
          .select("t.id")
          .where("t.id", "=", this.taskId),
      )
      .executeTakeFirst();
  }
}

export class TaskLockService {
  private locks = new Map<
    string, // uid
    TaskLock
  >();

  async lockTask(uid: string, userId: string, lockId: string) {
    let lock = this.locks.get(uid);
    if (!lock) {
      const taskId = uidCoder.decode(uid);
      lock = new TaskLock(taskId, userId, lockId);
    }

    await lock.checkLock(userId, lockId);
    lock.retain();
    this.locks.set(uid, lock);
  }

  async unlockTask(uid: string, userId: string, lockId: string) {
    const lock = this.locks.get(uid);
    if (lock) {
      await lock.checkLock(userId, lockId);
      if (await lock.release()) {
        this.locks.delete(uid);
      }
    }
  }

  async gracefulShutdown() {
    const taskLocksToRelease = Array.from(this.locks.values());
    this.locks.clear();

    console.info(
      `Process exiting, cleaning up ${taskLocksToRelease.length} task locks`,
    );
    const promises = [];
    for (const task of taskLocksToRelease) {
      promises.push(task.release(true));
    }
    await Promise.all(promises);
  }
}

export const taskLockService = new TaskLockService();
