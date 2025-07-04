import { zValidator } from "@hono/zod-validator";
import type { TaskCreateEvent, TaskEvent } from "@ragdoll/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../auth";
import { auth } from "../better-auth";
import { parseEventFilter } from "../lib/event-filter";
import { upgradeWebSocket } from "../lib/websocket";
import { setIdleTimeout } from "../server";
import { taskService } from "../service/task"; // Added import
import { taskEvents } from "../service/task-events";
import { ZodMessageType } from "../types";

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
  minionId: z.string().optional(),
  cwd: z.string().optional(),
  eventFilter: z
    .string()
    .optional()
    .transform((val) => parseEventFilter(val)),
  parentId: z
    .string()
    .optional()
    .describe(
      "List all sub tasks of a parent task by given parentId. If not provided, list all non-sub tasks.",
    ),
});

const TaskUidParamsSchema = z.object({
  uid: z.string(),
});

const TaskUidQuerySchema = z
  .object({
    includeSubTasks: z.coerce.boolean().optional(),
  })
  .optional();

const TaskLockParamsSchema = z.object({
  uid: z.string(),
  lockId: z.string(),
});

const ZodTaskCreateEvent: z.ZodType<TaskCreateEvent> = z.any();
const TaskCreateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  remote: z
    .boolean()
    .optional()
    .describe(
      "Whether to run the task remotely in sandbox for website:new-project",
    ),
  event: ZodTaskCreateEvent.optional(),
});

const TaskShareSchema = z.object({
  isPublicShared: z.boolean(),
});

const TaskPatchSchema = z.object({
  messages: z.array(ZodMessageType),
});

const AppendMessageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

const WebSocketTokenSchema = z.object({
  accessToken: z.string(),
});

// Create a tasks router with authentication
const tasks = new Hono()
  .post("/", zValidator("json", TaskCreateSchema), requireAuth(), async (c) => {
    const { prompt, event, remote } = c.req.valid("json");
    const user = c.get("user");

    if (!user.isWaitlistApproved) {
      throw new HTTPException(403, {
        message: "You are not approved by waitlist",
      });
    }

    let uid: string;
    let url: string | undefined;
    if (remote && event?.type === "website:new-project") {
      const { uid: remoteUid, minion } = await taskService.createWithRunner({
        user,
        prompt,
        event,
      });
      uid = remoteUid;
      url = `/api/minions/${minion.id}/redirect`;
    } else {
      uid = await taskService.createWithUserMessage(user.id, prompt, event);
      url = `vscode://TabbyML.pochi/?task=${uid}`;
    }

    return c.json({
      success: true,
      uid,
      url,
    });
  })

  // List tasks with pagination
  .get("/", zValidator("query", PaginationSchema), requireAuth(), async (c) => {
    const { cwd, page, limit, eventFilter, minionId, parentId } =
      c.req.valid("query");
    const user = c.get("user");

    const result = await taskService.list(
      user.id,
      page,
      limit,
      cwd,
      minionId,
      eventFilter,
      parentId,
    );

    return c.json(result);
  })

  // Get a single task by ID
  .get(
    "/:uid",
    zValidator("param", TaskUidParamsSchema),
    zValidator("query", TaskUidQuerySchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param") || {};
      const { includeSubTasks } = c.req.valid("query") || {};
      const user = c.get("user");
      const task = await taskService.get(uid, user.id, includeSubTasks);

      return c.json(task); // task already includes id
    },
  )

  // Get task events
  .get(
    "/:uid/events",
    zValidator("param", TaskUidParamsSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const user = c.get("user");

      const task = await taskService.get(uid, user.id);

      return streamSSE(c, async (stream) => {
        const unsubscribe = taskEvents.subscribe(uid, (e) => {
          stream.writeSSE({
            data: JSON.stringify(e),
          });
        });

        stream.onAbort(() => {
          unsubscribe();
        });

        // Send initial task data
        await stream.writeSSE({
          data: JSON.stringify({
            type: "task:status-changed",
            data: {
              uid,
              status: task.status,
            },
          } satisfies TaskEvent),
        });

        while (true) {
          setIdleTimeout(c.req.raw, 120);
          await new Promise((resolve) => setTimeout(resolve, 60 * 1000));
        }
      });
    },
  )

  // Delete a task by ID
  .delete(
    "/:uid",
    zValidator("param", TaskUidParamsSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const user = c.get("user");

      const deleted = await taskService.delete(uid, user.id);

      if (!deleted) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json({ success: true });
    },
  )

  // Share/unshare a task by ID
  .post(
    "/:uid/share",
    zValidator("param", TaskUidParamsSchema),
    zValidator("json", TaskShareSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const { isPublicShared } = c.req.valid("json");
      const user = c.get("user");
      const updated = await taskService.updateIsPublicShared(
        uid,
        user.id,
        isPublicShared,
      );

      if (!updated) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json({ success: true });
    },
  )

  // Get a public task by UID
  .get(
    "/:uid/public",
    zValidator("param", TaskUidParamsSchema),
    optionalAuth,
    async (c) => {
      const { uid } = c.req.valid("param");
      const user = c.get("user");

      const isInternalUser = user?.email?.endsWith("@tabbyml.com");
      const task = await taskService.getPublic(uid, user?.id, !!isInternalUser);

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      // Add 5-minute cache headers
      c.header("Cache-Control", "public, max-age=300, s-maxage=300");

      return c.json(task);
    },
  )
  .patch(
    "/:uid/messages",
    zValidator("param", TaskUidParamsSchema),
    zValidator("json", TaskPatchSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const { messages } = c.req.valid("json");
      const user = c.get("user");
      const updated = await taskService.patchMessages(uid, user.id, messages);
      if (!updated) {
        throw new HTTPException(404, { message: "Task not found" });
      }
      return c.json({ success: true });
    },
  )
  .post(
    "/:uid/append-user-message",
    zValidator("param", TaskUidParamsSchema),
    zValidator("json", AppendMessageSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const { prompt } = c.req.valid("json");
      const user = c.get("user");

      await taskService.appendUserMessage(user.id, uid, prompt);
      return c.json({ success: true });
    },
  )
  .post(
    "/:uid/lock/:lockId",
    zValidator("param", TaskLockParamsSchema),
    requireAuth(),
    async (c) => {
      const { uid, lockId } = c.req.valid("param");
      const user = c.get("user");
      await taskService.lock(uid, user.id, lockId);
      return c.json({ success: true });
    },
  )
  .delete(
    "/:uid/lock/:lockId",
    zValidator("param", TaskLockParamsSchema),
    requireAuth(),
    async (c) => {
      const { uid, lockId } = c.req.valid("param");
      const user = c.get("user");
      await taskService.releaseLock(uid, user.id, lockId);
      return c.json({ success: true });
    },
  )
  .get(
    "/:uid/lock/:lockId",
    zValidator("param", TaskLockParamsSchema),
    upgradeWebSocket(async (c) => {
      const params = TaskLockParamsSchema.parse(c.req.param());
      const { uid, lockId } = params;

      const { accessToken } = WebSocketTokenSchema.parse(c.req.query());
      const headers = new Headers(c.req.raw.headers);
      headers.delete("authorization");
      headers.set("Authorization", `Bearer ${encodeURIComponent(accessToken)}`);

      const session = await auth.api.getSession({
        headers,
        query: {
          disableRefresh: true,
        },
      });
      if (!session) {
        throw new HTTPException(401, {
          message: "Unauthorized",
        });
      }
      const user = session.user;
      await taskService.checkLock(uid, user.id, lockId);

      let refreshLockTimer: ReturnType<typeof setInterval> | undefined =
        undefined;

      const handleOpen = async () => {
        const refreshLock = async () => {
          try {
            await taskService.lock(uid, user.id, lockId);
          } catch (error) {
            console.error(`Failed to refresh ${uid} lockId: ${lockId}:`, error);
          }
        };
        refreshLock();
        refreshLockTimer = setInterval(refreshLock, 5 * 60 * 1000);
      };

      const handleClose = async () => {
        // Stop refreshing the lock
        if (refreshLockTimer) {
          clearInterval(refreshLockTimer);
        }

        // Release the lock when the WebSocket connection is closed
        try {
          await taskService.releaseLock(uid, user.id, lockId);
        } catch (error) {
          console.error(`Failed to release ${uid} lockId: ${lockId}:`, error);
        }
      };

      return {
        onOpen: handleOpen,
        onClose: handleClose,
        onError: handleClose,
      };
    }),
  );

export default tasks;
