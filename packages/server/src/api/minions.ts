import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { z } from "zod";
import { optionalAuth, requireAuth } from "../auth";
import { setIdleTimeout } from "../server";
import { minionService } from "../service/minion";

const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const minions = new Hono()
  // public redirect route
  // check minion alive and then redirect
  .get(
    "/redirect",
    zValidator("query", z.object({ url: z.string().url() })),
    async (c) => {
      setIdleTimeout(c.req.raw, 60); // 60 seconds idle timeout
      const { url } = c.req.valid("query");
      const targetUrl = await minionService.redirectByUrl(url);
      return c.text(targetUrl);
    },
  )
  // /token would handle auth itself,
  .get(
    "/token",
    zValidator("query", z.object({ url: z.string().url() })),
    optionalAuth,
    async (c) => {
      const { url } = c.req.valid("query");
      const user = c.get("user");

      if (!user?.id) {
        return c.redirect(
          `/auth/sign-in?redirectTo=${encodeURIComponent(`${process.env.BETTER_AUTH_URL || "https://app.getpochi.com"}/api/minions/token?url=${encodeURIComponent(url)}`)}`,
        );
      }

      try {
        await minionService.verifySandboxOwnership(user.id, url);
      } catch (e) {
        // sandbox not belong to user,
        // return to task list
        if (e instanceof HTTPException && e.status === 403) {
          const redirectTo = "/tasks";
          return c.redirect(redirectTo);
        }
        throw e;
      }

      const data = await minionService.generateJwt(user, url);

      const redirectUrl = new URL(url);
      redirectUrl.searchParams.set("pochi-credential", data.token);
      return c.redirect(redirectUrl.toString());
    },
  )
  // authed routes
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
  })
  .get("/:id/redirect-url", async (c) => {
    setIdleTimeout(c.req.raw, 60); // 60 seconds idle timeout
    const user = c.get("user");
    const { id } = c.req.param();
    const url = await minionService.redirect(user.id, id);
    return c.text(url);
  });

export default minions;
