import { isUserInputTool } from "@ragdoll/tools";
import { type FinishReason, type Message, appendClientMessage } from "ai";
import { HTTPException } from "hono/http-exception";
import { sql } from "kysely";
import type { z } from "zod";
import { type DB, type UserEvent, db } from "../db";
import {
  fromUIMessages,
  toUIMessage,
  toUIMessages,
} from "../lib/message-utils";
import { stripReadEnvironment } from "../prompts/environment";
import type { Environment, Todo, ZodChatRequestType } from "../types";
import { slackService } from "./slack";

const titleSelect =
  sql<string>`LEFT(SPLIT_PART((conversation #>> '{messages, 0, parts, 0, text}')::text, '\n', 1), 256)`.as(
    "title",
  );

class TaskService {
  async startStreaming(
    userId: string,
    streamId: string,
    request: z.infer<typeof ZodChatRequestType>,
  ) {
    const { id, conversation, event } = await this.prepareTask(userId, request);

    const messages = appendClientMessage({
      messages: toUIMessages(conversation?.messages || []),
      message: toUIMessage(request.message),
    });

    const messagesToSave = postProcessMessages(messages);

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
      .where("taskId", "=", id)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

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
    messages: Message[],
    finishReason: FinishReason,
    totalTokens: number | undefined,
    notify: boolean,
  ) {
    const status = getTaskStatus(messages, finishReason);
    const messagesToSave = postProcessMessages(messages);
    await db
      .updateTable("task")
      .set({
        status,
        conversation: {
          messages: fromUIMessages(messagesToSave),
        },
        totalTokens,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where("taskId", "=", taskId)
      .where("userId", "=", userId)
      .executeTakeFirstOrThrow();

    if (notify) {
      await this.sendTaskCompletionNotification(userId, taskId, status);
    }
  }

  private async sendTaskCompletionNotification(
    userId: string,
    taskId: number,
    status: DB["task"]["status"]["__select__"],
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
      .select(["conversation", "event", "environment", "status"])
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
        "totalTokens",
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
        "status",
        "conversation",
        "totalTokens",
        titleSelect,
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
}

export const taskService = new TaskService();

function postProcessMessages(messages: Message[]) {
  const ret = stripReadEnvironment(messages);
  for (const x of ret) {
    x.toolInvocations = undefined;
  }

  return ret;
}

export function getTaskStatus(
  messages: Message[],
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
