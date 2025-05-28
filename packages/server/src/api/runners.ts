import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import z from "zod";
import { auth, requireAuth } from "../auth";

const CreateRunnerSchema = z.object({});

const runners = new Hono()
  .use(requireAuth())
  .post("/", zValidator("json", CreateRunnerSchema), async (c) => {
    const user = c.get("user");
    const { token } = await (await auth.$context).internalAdapter.createSession(
      user.id,
      undefined,
    );

    // FIXME(Wei): pass token to the sandbox runner
    return c.json({ token });
  });

export default runners;
