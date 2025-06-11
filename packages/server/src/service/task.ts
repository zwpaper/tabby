import { isAbortError } from "@ai-sdk/provider-utils";
import {
  formatters,
  fromUIMessages,
  toUIMessage,
  toUIMessages,
} from "@ragdoll/common";
import {
  hasAttemptCompletion,
  parseTitle,
} from "@ragdoll/common/message-utils";
import type {
  DB,
  DBMessage,
  Environment,
  TaskError,
  Todo,
  UserEvent,
} from "@ragdoll/db";
import { isUserInputTool } from "@ragdoll/tools";
import {
  APICallError,
  type FinishReason,
  InvalidToolArgumentsError,
  type Message,
  NoSuchToolError,
  type UIMessage,
  appendClientMessage,
  generateId,
} from "ai";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import Sqids from "sqids";
import type { z } from "zod";
import { db } from "../db";
import { applyEventFilter } from "../lib/event-filter";
import { publishTaskEvent } from "../server";
import type { ZodChatRequestType } from "../types";
import { slackTaskService } from "./slack-task";

const titleSelect =
  sql<string>`(conversation #>> '{messages, 0, parts, 0, text}')::text`.as(
    "title",
  );

const { uidEncode, uidDecode } = (() => {
  const alphabet =
    "RBgHuE5stw6UbcCoZJiamLkyYnqV1xSO8efMhzXK3vI9F27WPrd0jA4lGTNpQD";
  const coder = new Sqids({ minLength: 8, alphabet });
  return {
    uidEncode: (id: number) => coder.encode([id]),
    uidDecode: (id: string) => coder.decode(id)[0],
  };
})();

class StreamingTask {
  constructor(
    readonly streamId: string,
    readonly userId: string,
    readonly uid: string,
  ) {}

  get key() {
    return StreamingTask.key(this.userId, this.uid);
  }

  static key(userId: string, uid: string) {
    return `${userId}:${uid}`;
  }
}

class TaskService {
  private streamingTasks = new Map<string, StreamingTask>();

  async startStreaming(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const streamId = generateId();
    const { conversation, event, uid } = await this.prepareTask(
      userId,
      request,
    );
    const streamingTask = new StreamingTask(streamId, userId, uid);
    this.streamingTasks.set(streamingTask.key, streamingTask);

    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(request.message),
    }) as UIMessage[];

    const messagesToSave = formatters.storage(messages);

    await db
      .updateTable("task")
      .set({
        status: "streaming",
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        environment: request.environment,
        streamIds: sql<
          string[]
        >`COALESCE("streamIds", '{}') || ARRAY[${streamId}]`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        uid,
        status: "streaming",
      },
    });

    return {
      streamId,
      event,
      messages,
      uid,
    };
  }

  async finishStreaming(
    uid: string,
    userId: string,
    messages: UIMessage[],
    finishReason: FinishReason,
    totalTokens: number | undefined,
  ) {
    const status = getTaskStatus(messages, finishReason);
    const messagesToSave = formatters.storage(messages);
    await db
      .updateTable("task")
      .set({
        status,
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        totalTokens,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        // Clear error on successful completion
        error: null,
      })
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        uid,
        status: status,
      },
    });

    this.streamingTasks.delete(StreamingTask.key(userId, uid));
    slackTaskService.notifyTaskStatusUpdate(userId, uid);
  }

  async failStreaming(uid: string, userId: string, error: TaskError) {
    await db
      .updateTable("task")
      .set({
        status: "failed",
        updatedAt: sql`CURRENT_TIMESTAMP`,
        error,
      })
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .execute();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        uid,
        status: "failed",
      },
    });

    this.streamingTasks.delete(StreamingTask.key(userId, uid));
    slackTaskService.notifyTaskStatusUpdate(userId, uid);
  }

  private async prepareTask(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const { id: chatId, event, environment } = request;
    let uid = chatId ?? undefined;
    if (uid === undefined) {
      uid = await this.create(userId, event);
    }

    const {
      id,
      environment: taskEnvironment,
      status,
      ...data
    } = await db
      .selectFrom("task")
      .select(["conversation", "event", "environment", "status", "id"])
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    this.verifyEnvironment(environment, taskEnvironment);

    if (status === "streaming") {
      throw new HTTPException(409, {
        message: "Task is already streaming",
      });
    }

    return {
      ...data,
      uid: uidEncode(id),
    };
  }

  private async create(userId: string, event: UserEvent | null = null) {
    return await this.createTaskImpl(userId, {
      event,
    });
  }

  async createWithUserMessage(
    userId: string,
    prompt: string,
    event?: UserEvent,
  ): Promise<string> {
    const message: DBMessage = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      role: "user",
      parts: [
        {
          type: "text",
          text: prompt,
        },
      ],
    };

    if (event?.type === "website:new-project") {
      if (event.data.attachments) {
        message.experimental_attachments = event.data.attachments;
      }
    }

    return await this.createTaskImpl(userId, {
      event: event || null,
      conversation: {
        messages: [message],
      },
      status: "pending-model",
    });
  }

  private async createTaskImpl(
    userId: string,
    taskData: Partial<{
      event: UserEvent | null;
      conversation: { messages: DBMessage[] } | null;
      status: DB["task"]["status"]["__insert__"];
    }>,
  ): Promise<string> {
    const { id } = await db.transaction().execute(async (trx) => {
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
          ...taskData,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
    });
    return uidEncode(id);
  }

  private verifyEnvironment(
    environment: Environment | undefined,
    expectedEnvironment: Environment | null,
  ) {
    if (expectedEnvironment === null) return;
    if (environment === undefined) {
      return;
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

  async list(
    userId: string,
    page: number,
    limit: number,
    cwd?: string,
    eventFilter?: Record<string, unknown>,
  ) {
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

    totalCountQuery = applyEventFilter(totalCountQuery, eventFilter);

    const totalCountResult = await totalCountQuery.executeTakeFirst();
    const totalCount = Number(totalCountResult?.count ?? 0);
    const totalPages = Math.ceil(totalCount / limit);

    let query = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .select([
        "id",
        "createdAt",
        "updatedAt",
        "status",
        "totalTokens",
        "event",
        titleSelect,
        gitSelect,
      ])
      .orderBy("id", "desc")
      .limit(limit)
      .offset(offset);

    if (cwd) {
      query = query.where(sql`environment->'info'->'cwd'`, "@>", `"${cwd}"`);
    }

    query = applyEventFilter(query, eventFilter);

    const items = await query.execute();
    const data = items.map(({ id, ...task }) => ({
      ...task,
      uid: uidEncode(id), // Map id to uid
      title: parseTitle(task.title),
      totalTokens: task.totalTokens || undefined,
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

  async get(uid: string, userId: string) {
    const taskQuery = db
      .selectFrom("task")
      .where("userId", "=", userId)
      .select([
        "createdAt",
        "updatedAt",
        "conversation",
        "totalTokens",
        "event",
        "status",
        "error",
        "isPublicShared",
        titleSelect,
        gitSelect,
        sql<Todo[] | null>`environment->'todos'`.as("todos"),
      ])
      .where("id", "=", uidDecode(uid));

    const task = await taskQuery.executeTakeFirst();

    if (!task) {
      return null; // Return null if task not found, let the API layer handle 404
    }

    return {
      ...task,
      uid,
      totalTokens: task.totalTokens || undefined,
      todos: task.todos || undefined,
      title: parseTitle(task.title),
    };
  }

  async getPublic(uid: string, userId?: string) {
    const taskQuery = db
      .selectFrom("task")
      .innerJoin("user", "task.userId", "user.id")
      .where("task.id", "=", uidDecode(uid))
      .where((eb) => {
        if (userId !== undefined) {
          return eb.or([
            eb("task.isPublicShared", "=", true),
            eb("task.userId", "=", userId),
          ]);
        }
        return eb("task.isPublicShared", "=", true);
      })
      .select([
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

    const task = await taskQuery.executeTakeFirst();

    if (!task) {
      return null;
    }

    const { userName, userImage, ...data } = task;

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
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  }

  async appendMessages(
    uid: string,
    userId: string,
    messages: DBMessage[],
  ): Promise<boolean> {
    const id = uidDecode(uid);
    const task = await db
      .selectFrom("task")
      .where("id", "=", id)
      .where("userId", "=", userId)
      .select(["conversation"])
      .executeTakeFirst();

    if (!task) {
      return false;
    }

    const existingMessages = toUIMessages(task.conversation?.messages ?? []);
    const existingMessageIds = new Set(existingMessages.map((m) => m.id));
    const newMessages = toUIMessages(
      messages.filter((m) => !existingMessageIds.has(m.id)),
    );

    if (newMessages.length === 0) {
      return true;
    }

    const allMessages = [...existingMessages, ...newMessages];
    const messagesToSave = formatters.storage(allMessages);

    const result = await db
      .updateTable("task")
      .set({
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", id)
      .where("userId", "=", userId)
      .executeTakeFirst();
    return result.numUpdatedRows > 0;
  }

  async delete(uid: string, userId: string): Promise<boolean> {
    const result = await db
      .deleteFrom("task")
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirst(); // Use executeTakeFirst for delete to get affected rows count

    return result.numDeletedRows > 0; // Return true if deletion was successful
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
      .where("id", "=", uidDecode(uid))
      .where("userId", "=", userId)
      .executeTakeFirst();

    return result?.latestStreamId ?? null;
  }

  async gracefulShutdown() {
    const streamingTasksToFail = Array.from(this.streamingTasks.values());
    const numTasksToFail = streamingTasksToFail.length;
    console.info(
      `Process exiting, cleaning up ${numTasksToFail} streaming tasks`,
    );
    if (numTasksToFail === 0) return;
    this.streamingTasks.clear();

    const promises = [];
    for (const task of streamingTasksToFail) {
      promises.push(
        this.failStreaming(task.uid, task.userId, {
          kind: "AbortError",
          message: "Server is shutting down, task was aborted",
        }),
      );
    }

    await Promise.all(promises);
  }

  toTaskError(error: unknown): TaskError {
    if (APICallError.isInstance(error)) {
      return {
        kind: "APICallError",
        message: error.message,
        requestBodyValues: error.requestBodyValues,
      };
    }

    const internalError = (message: string): TaskError => {
      return {
        kind: "InternalError",
        message,
      };
    };

    if (InvalidToolArgumentsError.isInstance(error)) {
      return internalError(
        `Invalid arguments provided to tool "${error.toolName}". Please try again.`,
      );
    }

    if (NoSuchToolError.isInstance(error)) {
      return internalError(`${error.toolName} is not a valid tool.`);
    }

    if (isAbortError(error)) {
      return {
        kind: "AbortError",
        message: error.message,
      };
    }

    if (!(error instanceof Error)) {
      console.error("Unknown error", error);
      return internalError("Something went wrong. Please try again.");
    }

    return internalError(error.message);
  }
}

export const taskService = new TaskService();

export function getTaskStatus(
  messages: UIMessage[],
  finishReason: FinishReason,
): DB["task"]["status"]["__select__"] {
  const lastMessage = messages[messages.length - 1];

  if (finishReason === "tool-calls") {
    if (hasAttemptCompletion(lastMessage)) {
      return "completed";
    }
    if (hasUserInputTool(lastMessage)) {
      return "pending-input";
    }
    return "pending-tool";
  }

  if (finishReason === "stop") {
    return "pending-input";
  }

  return "failed";
}

function hasUserInputTool(message: Message): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      isUserInputTool(part.toolInvocation.toolName),
  );
}

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
