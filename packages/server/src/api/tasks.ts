import { zValidator } from "@hono/zod-validator";
import type { TaskCreateEvent, TaskEvent } from "@ragdoll/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { type SSEStreamingApi, streamSSE } from "hono/streaming";
import { z } from "zod";
import { isInternalUser, optionalAuth, requireAuth } from "../auth";
import { parseEventFilter } from "../lib/event-filter";
import { setIdleTimeout } from "../server";
import { taskService } from "../service/task"; // Added import
import { taskEvents } from "../service/task-events";
import { spanConfig } from "../trace";

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

const TaskEventsQuerySchema = z
  .object({
    heartbeat: z.coerce.boolean().optional(),
  })
  .optional();

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

const AppendMessageSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
});

// Create a tasks router with authentication
const tasks = new Hono()
  .post("/", zValidator("json", TaskCreateSchema), requireAuth(), async (c) => {
    const { prompt, event, remote } = c.req.valid("json");
    const user = c.get("user");

    let uid: string;
    let url: string | undefined;
    let minionId: string | undefined;
    if (remote && event?.type === "website:new-project") {
      const { uid: remoteUid, minion } = await taskService.createWithRunner({
        user,
        prompt,
        event,
      });
      uid = remoteUid;
      url = `/api/minions/${minion.id}/redirect`;
      minionId = minion.id;
    } else {
      uid = await taskService.createWithUserMessage(user.id, prompt, event);
      url = `vscode://TabbyML.pochi/?task=${uid}`;
    }
    spanConfig.setAttribute("ragdoll.task.uid", uid);

    return c.json({
      success: true,
      uid,
      minionId,
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
    zValidator("query", TaskEventsQuerySchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param");
      const { heartbeat } = c.req.valid("query") || {};
      const user = c.get("user");

      let latestTaskEvent: TaskEvent | undefined = undefined;
      let sseStream: SSEStreamingApi | undefined = undefined;
      const unsubscribe = taskEvents.subscribe(uid, (e) => {
        latestTaskEvent = e;
        sseStream?.writeSSE({
          data: JSON.stringify(e),
        });
      });

      let task: Awaited<ReturnType<typeof taskService.get>> | undefined =
        undefined;
      try {
        task = await taskService.get(uid, user.id);
      } catch (error) {
        unsubscribe();
        throw error;
      }

      return streamSSE(c, async (stream) => {
        stream.onAbort(() => {
          unsubscribe();
        });
        sseStream = stream;

        // Send initial task data
        await stream.writeSSE({
          data: JSON.stringify(
            latestTaskEvent ??
              ({
                type: "task:status-changed",
                data: {
                  uid,
                  status: task.status,
                },
              } satisfies TaskEvent),
          ),
        });

        while (!stream.aborted && !stream.closed) {
          setIdleTimeout(c.req.raw, 120);
          await new Promise((resolve) => setTimeout(resolve, 15 * 1000));
          if (heartbeat && !stream.aborted && !stream.closed) {
            await stream.writeSSE({
              data: JSON.stringify({
                type: "heartbeat",
                data: {
                  timestamp: Date.now(),
                },
              }),
            });
          }
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
      spanConfig.setAttribute("ragdoll.task.uid", uid);

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

      const isInternal = user && isInternalUser(user);
      const task = await taskService.getPublic(uid, user?.id, !!isInternal);

      // Add 5-minute cache headers
      c.header("Cache-Control", "public, max-age=300, s-maxage=300");

      return c.json(task);
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
      spanConfig.setAttribute("ragdoll.task.uid", uid);

      await taskService.appendUserMessage(user.id, uid, prompt);
      return c.json({ success: true });
    },
  );

export default tasks;
