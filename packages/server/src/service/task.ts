import type { Environment, UserEvent } from "@ragdoll/common";
import type { Todo } from "@ragdoll/common";
import { fromUIMessages, toUIMessage, toUIMessages } from "@ragdoll/common";
import { formatters } from "@ragdoll/common";
import type { DBMessage } from "@ragdoll/common";
import { parseTitle } from "@ragdoll/common/message-utils";
import type { DB } from "@ragdoll/db";
import { isUserInputTool } from "@ragdoll/tools";
import {
  type FinishReason,
  type Message,
  type UIMessage,
  appendClientMessage,
  generateId,
} from "ai";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import type { z } from "zod";
import { db } from "../db";
import { applyEventFilter } from "../lib/event-filter";
import { publishTaskEvent } from "../server";
import type { ZodChatRequestType } from "../types";
import { slackService } from "./slack";

class StreamingTask {
  constructor(
    readonly streamId: string,
    readonly userId: string,
    readonly taskId: number,
  ) {}

  get key() {
    return StreamingTask.key(this.userId, this.taskId);
  }

  static key(userId: string, taskId: number) {
    return `${userId}:${taskId}`;
  }
}

class TaskService {
  private streamingTasks = new Map<string, StreamingTask>();

  async startStreaming(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const streamId = generateId();
    const { id, conversation, event } = await this.prepareTask(userId, request);
    const streamingTask = new StreamingTask(streamId, userId, id);
    this.streamingTasks.set(streamingTask.key, streamingTask);

    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(request.message),
    }) as UIMessage[];

    const messagesToSave = formatters.storage(messages);

    await db
      .updateTable("task")
      .set({
        statusMigrate: "streaming",
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        environment: request.environment,
        streamIds: sql<
          string[]
        >`COALESCE("streamIds", '{}') || ARRAY[${streamId}]`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("taskId", "=", id)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        taskId: id,
        status: "streaming",
      },
    });

    return {
      id,
      streamId,
      event,
      messages,
    };
  }

  async finishStreaming(
    taskId: number,
    userId: string,
    messages: UIMessage[],
    finishReason: FinishReason,
    totalTokens: number | undefined,
    notify: boolean,
  ) {
    const status = getTaskStatus(messages, finishReason);
    const messagesToSave = formatters.storage(messages);
    await db
      .updateTable("task")
      .set({
        statusMigrate: status,
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        totalTokens,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        taskId,
        status: status,
      },
    });

    this.streamingTasks.delete(StreamingTask.key(userId, taskId));

    if (notify) {
      this.sendTaskCompletionNotification(userId, taskId, status);
    }
  }

  async failStreaming(taskId: number, userId: string) {
    await db
      .updateTable("task")
      .set({ statusMigrate: "failed", updatedAt: sql`CURRENT_TIMESTAMP` })
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .execute();

    publishTaskEvent(userId, {
      type: "task:status-changed",
      data: {
        taskId,
        status: "failed",
      },
    });

    this.streamingTasks.delete(StreamingTask.key(userId, taskId));
  }

  private async sendTaskCompletionNotification(
    userId: string,
    taskId: number,
    status: DB["task"]["statusMigrate"]["__select__"],
  ) {
    if (status === "pending-tool") {
      return;
    }

    try {
      const slackIntegration = await slackService.getIntegration(userId);
      if (slackIntegration) {
        const { webClient, slackUserId } = slackIntegration;
        // Open a conversation with the user
        const openConversation = await webClient.conversations.open({
          users: slackUserId,
        });

        if (openConversation.ok && openConversation.channel?.id) {
          const channelId = openConversation.channel.id;
          await webClient.chat.postMessage({
            channel: channelId,
            text: `Task ${taskId} finished with status: ${status}`,
          });
        } else {
          console.error(
            `Failed to open conversation with user ${slackUserId}: ${openConversation.error}`,
          );
        }
      } else {
        console.warn(`Slack client not found for user ${userId}`);
      }
    } catch (error) {
      console.error(
        `Error sending Slack notification for task ${taskId}:`,
        error,
      );
    }
  }

  private async prepareTask(
    userId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const { id: chatId, event, environment } = request;
    let taskId = chatId ? Number.parseInt(chatId) : undefined;
    if (taskId === undefined) {
      taskId = await this.create(userId, event);
    }

    const data = await db
      .selectFrom("task")
      .select([
        "conversation",
        "event",
        "environment",
        sql<DB["task"]["statusMigrate"]>`statusMigrate`.as("status"),
      ])
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
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

  private async create(userId: string, event: UserEvent | null = null) {
    return await this.createTaskImpl(userId, {
      event,
    });
  }

  async createWithMessage(
    userId: string,
    message: DBMessage,
    event?: UserEvent,
  ): Promise<number> {
    return await this.createTaskImpl(userId, {
      event: event || null,
      conversation: {
        messages: [message],
      },
    });
  }

  private async createTaskImpl(
    userId: string,
    taskData: Partial<{
      event: UserEvent | null;
      conversation: { messages: DBMessage[] } | null;
    }>,
  ): Promise<number> {
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
          ...taskData,
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
        "taskId",
        "createdAt",
        "updatedAt",
        sql<DB["task"]["statusMigrate"]>`statusMigrate`.as("status"),
        "totalTokens",
        "event",
        titleSelect,
        gitSelect,
      ])
      .orderBy("taskId", "desc")
      .limit(limit)
      .offset(offset);

    if (cwd) {
      query = query.where(sql`environment->'info'->'cwd'`, "@>", `"${cwd}"`);
    }

    query = applyEventFilter(query, eventFilter);

    const items = await query.execute();
    const data = items.map((task) => ({
      ...task,
      id: task.taskId, // Map taskId to id
      title: parseTitle(task.title),
      totalTokens: task.totalTokens || undefined,
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
      .select([
        "createdAt",
        "updatedAt",
        "conversation",
        "totalTokens",
        "event",
        sql<DB["task"]["statusMigrate"]>`statusMigrate`.as("status"),
        titleSelect,
        gitSelect,
        sql<Todo[] | null>`environment->'todos'`.as("todos"),
      ])
      .executeTakeFirst();

    if (!task) {
      return null; // Return null if task not found, let the API layer handle 404
    }

    return {
      ...task,
      id: taskId, // Map taskId to id
      totalTokens: task.totalTokens || undefined,
      todos: task.todos || undefined,
      title: parseTitle(task.title),
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
      promises.push(this.failStreaming(task.taskId, task.userId));
    }

    await Promise.all(promises);
  }
}

export const taskService = new TaskService();

export function getTaskStatus(
  messages: Message[],
  finishReason: FinishReason,
): DB["task"]["statusMigrate"]["__select__"] {
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

function hasAttemptCompletion(message: Message): boolean {
  if (message.role !== "assistant") {
    return false;
  }

  return !!message.parts?.some(
    (part) =>
      part.type === "tool-invocation" &&
      part.toolInvocation.toolName === "attemptCompletion",
  );
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

const titleSelect = sql<
  string | null
>`(conversation #>> '{messages,0,parts,0,text}')::text`.as("title");

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
