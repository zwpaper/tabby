import { Hono } from "hono";
import { requireAuth } from "../auth";
import { minionService } from "../service/minion";

const minions = new Hono()
  .use(requireAuth())
  .get("/", async (c) => {
    const user = c.get("user");
    const data = await minionService.list(user.id);
    return c.json({
      data,
    });
  })
  .get("/:id", async (c) => {
    const user = c.get("user");
    const { id } = c.req.param();
    const data = await minionService.get(user.id, Number.parseInt(id));
    return c.json({
      data,
    });
  });

export default minions;
