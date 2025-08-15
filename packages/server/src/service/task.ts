import type { Todo } from "@getpochi/tools";
import type { Environment } from "@ragdoll/common";
import { parseTitle } from "@ragdoll/common/message-utils";
import type { PersistRequest } from "@ragdoll/common/pochi-api";
import type { DB } from "@ragdoll/db";
import type { Message } from "@ragdoll/livekit";
import { HTTPException } from "hono/http-exception";
import { type ExpressionWrapper, type SqlBool, sql } from "kysely";
import { db, minionIdCoder, uidCoder } from "../db";
import { applyEventFilter } from "../lib/event-filter";

const titleSelect = sql<string>`
      COALESCE(
        title,
        (conversation #>> '{messagesNext, 0, parts, 1, text}')::text,
        (conversation #>> '{messagesNext, 0, parts, 0, text}')::text,
        (conversation #>> '{messages, 0, parts, 1, text}')::text,
        (conversation #>> '{messages, 0, parts, 0, text}')::text
      )
    `.as("title");

// Select from table (integer, needs encoding)
const minionIdFromTable = sql<number | null>`"minionId"`.as("minionId");

// Select from environment (string, already encoded)
const legacyMinionId = sql<string | null>`environment->'info'->>'minionId'`.as(
  "legacyMinionId",
);

class TaskService {
  // async createWithUserMessage(
  //   userId: string,
  //   prompt: string,
  //   event?: TaskCreateEvent,
  //   parentId?: string | null,
  //   compactText?: string,
  // ): Promise<string> {
  //   const parts = [];
  //   if (compactText) {
  //     parts.push({
  //       type: "text" as const,
  //       text: compactText,
  //     });
  //   }
  //   parts.push({
  //     type: "text" as const,
  //     text: prompt,
  //   });
  //   const message: DBMessage = {
  //     id: generateId(),
  //     role: "user",
  //     parts,
  //   };

  //   if (event?.type === "website:new-project") {
  //     if (event.data.attachments) {
  //       message.experimental_attachments = event.data.attachments;
  //     }
  //   }

  //   return await this.createTaskImpl(userId, {
  //     event: event || null,
  //     conversation: {
  //       messages: [message],
  //     },
  //     status: "pending-model",
  //     parentId: parentId ? uidCoder.decode(parentId) : null,
  //   });
  // }

  // private async createTaskImpl(
  //   userId: string,
  //   taskData: Partial<{
  //     event: TaskCreateEvent | null;
  //     conversation: {
  //       messagesNext: Message[];
  //     } | null;
  //     status: DB["task"]["status"]["__insert__"];
  //     parentId: number | null;
  //   }>,
  // ): Promise<string> {
  //   const { id } = await db
  //     .insertInto("task")
  //     .values({
  //       userId,
  //       taskId: 0,
  //       ...taskData,
  //     })
  //     .returning("id")
  //     .executeTakeFirstOrThrow();
  //   return uidCoder.encode(id);
  // }

  async list(
    userId: string,
    page: number,
    limit: number,
    cwd?: string,
    minionId?: string,
    eventFilter?: Record<string, unknown>,
    parentId?: string | null,
  ) {
    const offset = (page - 1) * limit;

    let totalCountQuery = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .where("isDeleted", "=", false)
      .select(db.fn.count("id").as("count"));

    if (cwd) {
      totalCountQuery = totalCountQuery.where(
        sql`environment->'info'->>'cwd'`,
        "=",
        cwd,
      );
    }

    if (minionId) {
      totalCountQuery = totalCountQuery.where((eb) =>
        eb.or([
          eb("minionId", "=", minionIdCoder.decode(minionId)),
          eb(sql`environment->'info'->>'minionId'`, "=", minionId),
        ]),
      );
    }

    totalCountQuery = applyEventFilter(totalCountQuery, eventFilter);

    if (!parentId) {
      totalCountQuery = totalCountQuery.where("parentId", "is", null);
    } else {
      totalCountQuery = totalCountQuery.where(
        "parentId",
        "=",
        uidCoder.decode(parentId),
      );
    }

    const totalCountResult = await totalCountQuery.executeTakeFirst();
    const totalCount = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    let query = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .where("isDeleted", "=", false)
      .select([
        "id",
        "createdAt",
        "updatedAt",
        "status",
        "totalTokens",
        "event",
        "parentId",
        titleSelect,
        gitSelect,
        minionIdFromTable,
        legacyMinionId,
      ])
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset);

    if (cwd) {
      query = query.where(sql`environment->'info'->>'cwd'`, "=", cwd);
    }

    if (minionId) {
      query = query.where((eb) =>
        eb.or([
          eb("minionId", "=", minionIdCoder.decode(minionId)),
          eb(sql`environment->'info'->>'minionId'`, "=", minionId),
        ]),
      );
    }

    query = applyEventFilter(query, eventFilter);

    if (!parentId) {
      query = query.where("parentId", "is", null);
    } else {
      query = query.where("parentId", "=", uidCoder.decode(parentId));
    }

    const items = await query.execute();
    const data = items.map(({ id, minionId, legacyMinionId, ...task }) => ({
      ...task,
      uid: uidCoder.encode(id), // Map id to uid
      title: parseTitle(task.title),
      totalTokens: task.totalTokens || undefined,
      minionId: minionId
        ? minionIdCoder.encode(minionId)
        : legacyMinionId || undefined,
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

  async get(uid: string, userId: string, includeSubTasks = false) {
    const taskId = uidCoder.decode(uid);
    const taskQuery = db
      .selectFrom("task")
      .select([
        "id",
        "createdAt",
        "updatedAt",
        "conversation",
        "totalTokens",
        "event",
        "status",
        "error",
        "isPublicShared",
        "parentId",
        "userId",
        titleSelect,
        gitSelect,
        minionIdFromTable,
        legacyMinionId,
        sql<Todo[] | null>`environment->'todos'`.as("todos"),
      ])
      .where((eb) => {
        let condition: ExpressionWrapper<DB, "task", SqlBool>;
        if (includeSubTasks) {
          condition = eb.and([
            eb("isDeleted", "=", false),
            eb.or([eb("id", "=", taskId), eb("parentId", "=", taskId)]),
          ]);
        } else {
          condition = eb("id", "=", taskId);
        }
        return eb.and([eb("isDeleted", "=", false), condition]);
      });

    const tasks = await taskQuery.execute();
    if (!tasks || tasks.length === 0) {
      throw new HTTPException(404, { message: "Task not found" });
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new HTTPException(404, { message: "Task not found" });
    }
    if (userId !== task.userId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const subtasks = tasks.filter((t) => t.id !== taskId);

    return {
      ...task,
      uid,
      parentId: task.parentId !== null ? uidCoder.encode(task.parentId) : null,
      totalTokens: task.totalTokens || undefined,
      todos: task.todos || undefined,
      title: parseTitle(task.title),
      minionId: task.minionId
        ? minionIdCoder.encode(task.minionId)
        : task.legacyMinionId || undefined,
      subtasks: includeSubTasks
        ? subtasks.map((subtask) => ({
            uid: uidCoder.encode(subtask.id),
            status: subtask.status,
            conversation: subtask.conversation,
            todos: subtask.todos || undefined,
          }))
        : undefined,
    };
  }

  async getPublic(
    uid: string,
    userId: string | undefined,
    isInternalUser: boolean,
  ) {
    let taskId: number;
    try {
      taskId = uidCoder.decode(uid);
    } catch (err) {
      throw new HTTPException(400, { message: "Invalid task ID" });
    }
    const taskQuery = db
      .selectFrom("task")
      .innerJoin("user", "task.userId", "user.id")
      .where((eb) => {
        return eb.and([
          eb("task.isDeleted", "=", false),
          eb.or([eb("task.id", "=", taskId), eb("task.parentId", "=", taskId)]),
        ]);
      })
      .select([
        "task.id",
        "task.userId",
        "task.isPublicShared",
        "task.createdAt",
        "task.updatedAt",
        "task.conversation",
        "task.totalTokens",
        "task.status",
        "user.name as userName",
        "user.image as userImage",
        titleSelect,
        gitSelect,
        sql<Todo[] | null>`task.environment->'todos'`.as("todos"),
      ]);

    const tasks = await taskQuery.execute();
    if (!tasks || tasks.length === 0) {
      throw new HTTPException(404, { message: "Task not found" });
    }

    const task = tasks.find((t) => t.id === taskId);
    if (!task) {
      throw new HTTPException(404, { message: "Task not found" });
    }

    if (!isInternalUser && !task.isPublicShared && task.userId !== userId) {
      throw new HTTPException(403, { message: "Forbidden" });
    }

    const subtasks = tasks.filter((t) => t.id !== taskId);

    const {
      userName,
      userImage,
      userId: taskUserId,
      isPublicShared,
      ...data
    } = task;

    return {
      ...data,
      user: {
        name: userName,
        image: userImage,
      },
      uid,
      totalTokens: task.totalTokens || undefined,
      todos: task.todos || undefined,
      title: parseTitle(task.title),
      subtasks: subtasks.map((subtask) => ({
        uid: uidCoder.encode(subtask.id),
        status: subtask.status,
        conversation: subtask.conversation,
        todos: subtask.todos || undefined,
      })),
    };
  }

  async updateIsPublicShared(
    uid: string,
    userId: string,
    isPublicShared: boolean,
  ): Promise<boolean> {
    const result = await db
      .updateTable("task")
      .set({
        isPublicShared,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .where("isDeleted", "=", false)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  }

  async delete(uid: string, userId: string): Promise<boolean> {
    const result = await db
      .updateTable("task")
      .set({
        isDeleted: true,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  }

  async fetchLatestStreamId(
    uid: string,
    userId: string,
  ): Promise<string | null> {
    const result = await db
      .selectFrom("task")
      .select(
        sql<string>`("streamIds")[array_upper("streamIds", 1)]`.as(
          "latestStreamId",
        ),
      )
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .executeTakeFirst();

    return result?.latestStreamId ?? null;
  }

  // async createWithRunner({
  //   user,
  //   prompt,
  //   event,
  //   githubRepository,
  // }: {
  //   user: {
  //     id: string;
  //     name: string;
  //     email: string;
  //   };
  //   prompt: string;
  //   event: TaskCreateEvent;
  //   githubRepository?: { owner: string; repo: string };
  // }) {
  //   const githubAccessToken = await githubService.getAccessToken(user.id);

  //   if (!githubAccessToken) {
  //     throw new HTTPException(401, {
  //       message: PochiApiErrors.RequireGithubIntegration,
  //     });
  //   }

  //   const uid = await this.createWithUserMessage(user.id, prompt, event);
  //   const minion = await minionService.create({
  //     user,
  //     uid,
  //     githubAccessToken,
  //     githubRepository,
  //   });

  //   // Update the task with the minion ID
  //   await db
  //     .updateTable("task")
  //     .set({
  //       minionId: minionIdCoder.decode(minion.id),
  //       updatedAt: sql`CURRENT_TIMESTAMP`,
  //     })
  //     .where("id", "=", uidCoder.decode(uid))
  //     .executeTakeFirstOrThrow();

  //   return { uid, minion };
  // }

  // async appendUserMessage(userId: string, uid: string, prompt: string) {
  //   const userMessage: DBMessage = {
  //     id: generateId(),
  //     role: "user",
  //     parts: [
  //       {
  //         type: "text",
  //         text: prompt,
  //       },
  //     ],
  //   };
  //   const task = await this.get(uid, userId);
  //   if (
  //     !task ||
  //     (task.status !== "pending-input" && task.status !== "completed")
  //   ) {
  //     throw new HTTPException(400, {
  //       message: "Task is not in pending-input or completed state",
  //     });
  //   }

  //   const messagesToSave = [
  //     ...(task.conversation?.messages || []),
  //     userMessage,
  //   ];

  //   // Use a subquery with leftJoin to check for locks atomically
  //   const taskId = uidCoder.decode(uid);
  //   const result = await db
  //     .updateTable("task")
  //     .set({
  //       status: "pending-model",
  //       conversation: {
  //         messages: messagesToSave,
  //       },
  //       updatedAt: sql`CURRENT_TIMESTAMP`,
  //     })
  //     .where("id", "=", taskId)
  //     .where("userId", "=", userId)
  //     .where((eb) =>
  //       eb.or([
  //         eb("status", "=", "pending-input"),
  //         eb("status", "=", "completed"),
  //       ]),
  //     )
  //     .executeTakeFirst();

  //   if (!result || result.numUpdatedRows === 0n) {
  //     throw new HTTPException(423, {
  //       message: "Task is locked by another session",
  //     });
  //   }

  //   // if task is slack event we need resume the minion
  //   if (task.event?.type === "slack:new-task" && task.minionId) {
  //     minionService.resumeMinion(userId, task.minionId);
  //   }
  // }

  async persistTask(
    userId: string,
    clientTaskId: string,
    status: PersistRequest["status"],
    messagesNext: Message[],
    environment?: Environment,
    parentClientTaskId?: string,
  ) {
    let parentId: number | null = null;
    if (parentClientTaskId) {
      const parentTask = await db
        .selectFrom("task")
        .select("id")
        .where("clientTaskId", "=", parentClientTaskId)
        .where("userId", "=", userId)
        .executeTakeFirst();
      if (!parentTask) {
        throw new HTTPException(400, {
          message: "Invalid parent client task id",
        });
      }
      parentId = parentTask.id;
    }

    const { id } = await db
      .insertInto("task")
      .values({
        userId,
        conversation: {
          messagesNext,
        },
        clientTaskId,
        environment,
        taskId: 0,
        parentId: parentId,
      })
      .onConflict((oc) =>
        oc.columns(["userId", "clientTaskId"]).doUpdateSet(() => ({
          conversation: {
            messages: [],
            messagesNext,
          },
          status,
          isPublicShared: true,
          environment,
        })),
      )
      .returning("id")
      .executeTakeFirstOrThrow();
    return uidCoder.encode(id);
  }
}

export const taskService = new TaskService();

// Build git object with origin and branch from environment
const gitSelect = sql<{ origin: string; branch: string } | null>`
  CASE
    WHEN environment #>> '{workspace,gitStatus,origin}' IS NULL THEN NULL
    ELSE json_build_object(
      'origin', environment #>> '{workspace,gitStatus,origin}',
      'branch', environment #>> '{workspace,gitStatus,currentBranch}'
    )
  END
`.as("git");
