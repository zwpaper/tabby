import type { Message } from "ai";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import type { User } from "../auth";
import { type DB, type UserEvent, db } from "../db";
import { fromUIMessages } from "../lib/message-utils";
import type { Environment } from "../types";

const titleSelect =
  sql<string>`LEFT(SPLIT_PART((conversation #>> '{messages, 0, parts, 0, text}')::text, '\n', 1), 256)`.as(
    "title",
  );

class TaskService {
  async start(
    user: User,
    chatId: string | undefined,
    event: UserEvent | undefined,
    environment: Environment | undefined,
  ) {
    let taskId = chatId ? Number.parseInt(chatId) : undefined;
    if (taskId === undefined) {
      taskId = await this.create(user.id, event);
    }

    const data = await db
      .selectFrom("task")
      .select(["conversation", "event", "environment", "status"])
      .where("taskId", "=", taskId)
      .where("userId", "=", user.id)
      .executeTakeFirstOrThrow();

    this.verifyEnvironment(environment, data.environment);

    if (data.status === "streaming") {
      throw new HTTPException(409, {
        message: "Task is already streaming",
      });
    }

    return {
      ...data,
      environment: undefined,
      status: undefined,
      id: taskId,
    };
  }

  async create(userId: string, event: UserEvent | null = null) {
    const { taskId } = await db.transaction().execute(async (trx) => {
      const { nextTaskId } = await trx
        .insertInto("taskSequence")
        .values({ userId })
        .onConflict((oc) =>
          oc.column("userId").doUpdateSet({
            nextTaskId: sql`\"taskSequence\".\"nextTaskId\" + 1`,
          }),
        )
        .returning("nextTaskId")
        .executeTakeFirstOrThrow();

      return await trx
        .insertInto("task")
        .values({
          userId,
          taskId: nextTaskId,
          event,
        })
        .returning("taskId")
        .executeTakeFirstOrThrow();
    });
    return taskId;
  }

  private verifyEnvironment(
    environment: Environment | undefined,
    expectedEnvironment: Environment | null,
  ) {
    if (expectedEnvironment === null) return;
    if (environment === undefined) {
      throw new HTTPException(400, {
        message: "Environment is required",
      });
    }

    if (environment.info.os !== expectedEnvironment.info.os) {
      throw new HTTPException(400, {
        message: "Environment OS mismatch",
      });
    }

    if (environment.info.cwd !== expectedEnvironment.info.cwd) {
      throw new HTTPException(400, {
        message: "Environment CWD mismatch",
      });
    }
  }

  async update(
    taskId: number,
    userId: string,
    status: DB["task"]["status"]["__update__"],
    environment: Environment | undefined,
    messages: Message[],
  ) {
    return db
      .updateTable("task")
      .set({
        status,
        conversation: {
          messages: fromUIMessages(messages),
        },
        environment,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();
  }

  async list(userId: string, page: number, limit: number, cwd?: string) {
    const offset = (page - 1) * limit;

    let totalCountQuery = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .select(db.fn.count("id").as("count"));

    if (cwd) {
      totalCountQuery = totalCountQuery.where(
        sql`environment->'info'->'cwd'`,
        "@>",
        `"${cwd}"`,
      );
    }
    const totalCountResult = await totalCountQuery.executeTakeFirst();
    const totalCount = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    let query = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .select([
        "taskId",
        "createdAt",
        "updatedAt",
        "status",
        sql<UserEvent["type"] | null>`event -> 'type'`.as("eventType"),
        titleSelect,
      ])
      .orderBy("taskId", "desc")
      .limit(limit)
      .offset(offset);

    if (cwd) {
      query = query.where(sql`environment->'info'->'cwd'`, "@>", `"${cwd}"`);
    }

    const items = await query.execute();
    const data = items.map((task) => ({
      ...task,
      id: task.taskId, // Map taskId to id
      title: task.title || "(empty)",
      // Ensure all selected fields are correctly mapped if names differ
    }));

    return {
      data,
      pagination: {
        totalCount,
        limit,
        currentPage: page,
        totalPages,
      },
    };
  }

  async get(taskId: number, userId: string) {
    const task = await db
      .selectFrom("task")
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .select(["createdAt", "updatedAt", "status", "conversation", titleSelect])
      .executeTakeFirst();

    if (!task) {
      return null; // Return null if task not found, let the API layer handle 404
    }
    return {
      ...task,
      id: taskId, // Map taskId to id
    };
  }

  async delete(taskId: number, userId: string): Promise<boolean> {
    const task = await db
      .selectFrom("task")
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .select("taskId") // Select minimal data for existence check
      .executeTakeFirst();

    if (!task) {
      return false; // Task not found
    }

    const result = await db
      .deleteFrom("task")
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirst(); // Use executeTakeFirst for delete to get affected rows count

    return result.numDeletedRows > 0; // Return true if deletion was successful
  }

  async appendStreamId(taskId: number, userId: string, streamId: string) {
    return db
      .updateTable("task")
      .set({
        streamIds: sql<
          string[]
        >`COALESCE("streamIds", '{}') || ARRAY[${streamId}]`,
      })
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();
  }

  async fetchLatestStreamId(
    taskId: number,
    userId: string,
  ): Promise<string | null> {
    const result = await db
      .selectFrom("task")
      .select(
        sql<string>`("streamIds")[array_upper("streamIds", 1)]`.as(
          "latestStreamId",
        ),
      )
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirst();

    return result?.latestStreamId ?? null;
  }
}

export const taskService = new TaskService();
