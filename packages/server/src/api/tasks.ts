import { zValidator } from "@hono/zod-validator";
import type { UserEvent } from "@ragdoll/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../auth";
import { parseEventFilter } from "../lib/event-filter";
import { taskService } from "../service/task"; // Added import
import { ZodMessageType } from "../types";

// Define validation schemas
const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  cwd: z.string().optional(),
  eventFilter: z
    .string()
    .optional()
    .transform((val) => parseEventFilter(val)),
});

const TaskUidParamsSchema = z.object({
  uid: z.string(),
});

const ZodUserEvent: z.ZodType<UserEvent> = z.any();
const TaskCreateSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  event: ZodUserEvent.optional(),
});

const TaskShareSchema = z.object({
  isPublicShared: z.boolean(),
});

const TaskPatchSchema = z.object({
  messages: z.array(ZodMessageType),
});

// Create a tasks router with authentication
const tasks = new Hono()
  .post("/", zValidator("json", TaskCreateSchema), requireAuth(), async (c) => {
    const { prompt, event } = c.req.valid("json");
    const user = c.get("user");

    let uid: string;
    let url: string | undefined;
    if (event?.type === "website:new-remote-project") {
      const { uid: remoteUid, minion } = await taskService.createWithRunner({
        userId: user.id,
        userEmail: user.email,
        prompt,
        event,
      });
      uid = remoteUid;
      url = minion?.url;
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
    const { cwd, page, limit, eventFilter } = c.req.valid("query");
    const user = c.get("user");

    const result = await taskService.list(
      user.id,
      page,
      limit,
      cwd,
      eventFilter,
    );

    return c.json(result);
  })

  // Get a single task by ID
  .get(
    "/:uid",
    zValidator("param", TaskUidParamsSchema),
    requireAuth(),
    async (c) => {
      const { uid } = c.req.valid("param") || {};
      const user = c.get("user");

      const task = await taskService.get(uid, user.id);

      if (!task) {
        throw new HTTPException(404, { message: "Task not found" });
      }

      return c.json(task); // task already includes id
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

      const task = await taskService.getPublic(uid, user?.id);

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
      const updated = await taskService.appendMessages(uid, user.id, messages);
      if (!updated) {
        throw new HTTPException(404, { message: "Task not found" });
      }
      return c.json({ success: true });
    },
  );

export default tasks;
