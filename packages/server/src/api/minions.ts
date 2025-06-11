import { Hono } from "hono";
import { requireAuth } from "../auth";
import { minionService } from "../service/minion";

const minions = new Hono().get("/", requireAuth(), async (c) => {
  const user = c.get("user");
  const data = await minionService.list(user.id);
  return c.json({
    data,
  });
});

export default minions;
