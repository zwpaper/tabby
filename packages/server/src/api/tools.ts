import { ClientTools, ServerTools } from "@ragdoll/tools";
import { Hono } from "hono";
import { requireAuth } from "../auth";

const allTools = Object.entries({ ...ClientTools, ...ServerTools })
  .map(([id, tool]) => ({
    id,
    description: tool.description?.split("\n\n")[0],
  }))
  .filter(
    (tool) => tool.id !== "readEnvironment" && tool.id !== "slackReplyThread",
  );

const tools = new Hono().use(requireAuth()).get("/", (c) => {
  return c.json(allTools);
});

export default tools;
