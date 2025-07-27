import { isAbortError } from "@ai-sdk/provider-utils";
import { type Todo, isUserInputTool } from "@getpochi/tools";
import {
  appendMessages,
  formatters,
  fromUIMessages,
  getLogger,
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
  TaskCreateEvent,
  TaskError,
} from "@ragdoll/db";
import {
  APICallError,
  type FinishReason,
  InvalidToolArgumentsError,
  type Message,
  NoSuchToolError,
  type UIMessage,
  generateId,
  generateText,
} from "ai";
import { HTTPException } from "hono/http-exception";
import { type ExpressionWrapper, type SqlBool, sql } from "kysely";
import type { z } from "zod";
import { ServerErrors } from "..";
import { db, minionIdCoder, uidCoder } from "../db";
import { geminiFlash } from "../lib/constants";
import { applyEventFilter } from "../lib/event-filter";
import type { ZodChatRequestType } from "../types";
import { githubService } from "./github";
import { minionService } from "./minion";

const titleSelect = sql<string>`
      COALESCE(
        title,
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

const logger = getLogger("TaskService");

class TaskService {
  async startStreaming(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const streamId = generateId();
    const { conversation, uid, parentId, title } = await this.prepareTask(
      userId,
      request,
    );

    const messagesToAppend =
      request.messages ?? (request.message ? [request.message] : []);

    if (messagesToAppend.length === 0) {
      throw new Error("No messages to append");
    }

    const messages = appendMessages(
      toUIMessages(conversation?.messages ?? []),
      toUIMessages(messagesToAppend),
    );

    let newTitle = undefined;
    if (!title && messages.length) {
      newTitle = await taskService.checkAndGenerateTaskTitle(messages);
    }

    const messagesToSave = formatters.storage(messages);

    await db
      .updateTable("task")
      .set({
        // underlying we merged two state transition - pending-input -> pending-model -> streaming
        status: "streaming",
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        environment: request.environment,
        minionId: request.minionId
          ? minionIdCoder.decode(request.minionId)
          : undefined,
        streamIds: sql<
          string[]
        >`COALESCE("streamIds", '{}') || ARRAY[${streamId}]`,
        title: newTitle,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    // Keep the minion active
    if (request.minionId) {
      minionService.signalKeepAliveMinion(userId, request.minionId);
    }

    return {
      streamId,
      messages,
      uid,
      isSubTask: parentId !== null,
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
        // Update pending/in-progress todos to completed status when task is completed
        environment: sql`
          CASE
            WHEN ${status} = 'completed' THEN
              jsonb_set(
                COALESCE(environment, '{}'),
                '{todos}',
                COALESCE(
                  (
                    SELECT jsonb_agg(
                      CASE
                        WHEN todo_item->>'status' != 'cancelled' THEN
                          jsonb_set(todo_item, '{status}', '"completed"')
                        ELSE todo_item
                      END
                    )
                    FROM jsonb_array_elements(COALESCE(environment->'todos', '[]'::jsonb)) AS todo_item
                  ),
                  '[]'::jsonb
                )
              )
            ELSE environment
          END
        `,
      })
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();
  }

  async failStreaming(uid: string, userId: string, error: TaskError) {
    await db
      .updateTable("task")
      .set({
        status: "failed",
        updatedAt: sql`CURRENT_TIMESTAMP`,
        error,
      })
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .execute();
  }

  private async prepareTask(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const { id: chatId, event, environment, minionId } = request;
    let uid = chatId ?? undefined;
    if (uid === undefined) {
      uid = await this.create(userId, event);
    }

    const {
      id,
      environment: taskEnvironment,
      status,
      minionId: taskMinionId,
      legacyMinionId: taskMinionIdFromEnv,
      ...data
    } = await db
      .selectFrom("task")
      .select([
        "conversation",
        "event",
        "environment",
        "status",
        "id",
        "parentId",
        "title",
        minionIdFromTable,
        legacyMinionId,
      ])
      .where("id", "=", uidCoder.decode(uid))
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    this.verifyEnvironment(environment, taskEnvironment);

    const effectiveTaskMinionIdString = taskMinionId
      ? minionIdCoder.encode(taskMinionId)
      : taskMinionIdFromEnv;

    if (
      minionId &&
      effectiveTaskMinionIdString &&
      minionId !== effectiveTaskMinionIdString
    ) {
      throw new HTTPException(400, {
        message: "Minion ID mismatch",
      });
    }

    if (status === "streaming") {
      throw new HTTPException(409, {
        message: "Task is already streaming",
      });
    }

    return {
      ...data,
      uid: uidCoder.encode(id),
    };
  }

  private async create(userId: string, event: TaskCreateEvent | null = null) {
    return await this.createTaskImpl(userId, {
      event,
    });
  }

  async createWithUserMessage(
    userId: string,
    prompt: string,
    event?: TaskCreateEvent,
    parentId?: string | null,
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
      parentId: parentId ? uidCoder.decode(parentId) : null,
    });
  }

  private async createTaskImpl(
    userId: string,
    taskData: Partial<{
      event: TaskCreateEvent | null;
      conversation: { messages: DBMessage[] } | null;
      status: DB["task"]["status"]["__insert__"];
      parentId: number | null;
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
    return uidCoder.encode(id);
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
    const taskId = uidCoder.decode(uid);
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
      logger.error("Unknown error", error);
      return internalError("Something went wrong. Please try again.");
    }

    return internalError(error.message);
  }

  async createWithRunner({
    user,
    prompt,
    event,
    githubRepository,
  }: {
    user: {
      id: string;
      name: string;
      email: string;
    };
    prompt: string;
    event: TaskCreateEvent;
    githubRepository?: { owner: string; repo: string };
  }) {
    const githubAccessToken = await githubService.getAccessToken(user.id);

    if (!githubAccessToken) {
      throw new HTTPException(401, {
        message: ServerErrors.RequireGithubIntegration,
      });
    }

    const uid = await this.createWithUserMessage(user.id, prompt, event);
    const minion = await minionService.create({
      user,
      uid,
      githubAccessToken,
      githubRepository,
    });

    // Update the task with the minion ID
    await db
      .updateTable("task")
      .set({
        minionId: minionIdCoder.decode(minion.id),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", uidCoder.decode(uid))
      .executeTakeFirstOrThrow();

    return { uid, minion };
  }

  async appendUserMessage(userId: string, uid: string, prompt: string) {
    const userMessage: DBMessage = {
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
    const task = await this.get(uid, userId);
    if (
      !task ||
      (task.status !== "pending-input" && task.status !== "completed")
    ) {
      throw new HTTPException(400, {
        message: "Task is not in pending-input or completed state",
      });
    }

    const messagesToSave = [
      ...(task.conversation?.messages || []),
      userMessage,
    ];

    // Use a subquery with leftJoin to check for locks atomically
    const taskId = uidCoder.decode(uid);
    const result = await db
      .updateTable("task")
      .set({
        status: "pending-model",
        conversation: {
          messages: messagesToSave,
        },
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("id", "=", taskId)
      .where("userId", "=", userId)
      .where((eb) =>
        eb.or([
          eb("status", "=", "pending-input"),
          eb("status", "=", "completed"),
        ]),
      )
      .executeTakeFirst();

    if (!result || result.numUpdatedRows === 0n) {
      throw new HTTPException(423, {
        message: "Task is locked by another session",
      });
    }

    // if task is slack event we need resume the minion
    if (task.event?.type === "slack:new-task" && task.minionId) {
      minionService.resumeMinion(userId, task.minionId);
    }
  }

  async generateTaskTitle(messages: UIMessage[]) {
    const result = await generateText({
      model: geminiFlash,
      messages: formatters.llm(
        [
          ...messages,
          {
            role: "user",
            parts: [
              {
                type: "text",
                text: `
Generate a concise title that captures the essence of the above conversation. Requirements:
- Create a single descriptive phrase or short sentence
- Focus on the user's main request or topic
- Use plain text only (no markdown, formatting, or special characters)
- Do not include any punctuation at the end
- Return only the title text, nothing else
              `,
              },
            ],
            content: "",
            id: generateId(),
          },
        ],
        {
          isClaude: false,
          removeSystemReminder: true,
        },
      ),
    });
    const generatedTitle = await result.text;

    return trimEndingPunctuation(generatedTitle);
  }

  async checkAndGenerateTaskTitle(messages: UIMessage[]) {
    try {
      let partCount = 0;
      for (const message of messages) {
        partCount += message.parts.length;
      }
      if (partCount < 5 || partCount > 10) return undefined;

      const generatedTitle = await this.generateTaskTitle(messages);
      return generatedTitle;
    } catch (error) {
      logger.error("Error generating task title", error);
    }
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

const trimEndingPunctuation = (text: string) => {
  // This regex removes common sentence-ending punctuation and whitespace from the end of a string.
  // It targets characters like periods, commas, question marks, exclamation marks, and their full-width equivalents.
  return text.replace(/[.,?_!\s。，？！]+$/gu, "");
};
