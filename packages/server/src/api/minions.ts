import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireAuth } from "../auth";
import { setIdleTimeout } from "../server";
import { minionService } from "../service/minion";

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const minions = new Hono()
  .use(requireAuth())
  .get("/", zValidator("query", PaginationSchema), async (c) => {
    const user = c.get("user");
    const { page, limit } = c.req.valid("query");
    const data = await minionService.list(user.id, page, limit);
    return c.json(data);
  })
  .get("/:id", async (c) => {
    const user = c.get("user");
    const { id } = c.req.param();
    const data = await minionService.get(user.id, id);
    return c.json({
      data,
    });
  })
  .get("/:id/redirect", async (c) => {
    setIdleTimeout(c.req.raw, 60); // 60 seconds idle timeout
    const user = c.get("user");
    const { id } = c.req.param();
    const url = await minionService.redirect(user.id, id);
    return c.redirect(url);
  });

export default minions;
