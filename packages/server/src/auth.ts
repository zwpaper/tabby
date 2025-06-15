import { createMiddleware } from "hono/factory";
import { auth } from "./better-auth";

export const authRequest = createMiddleware<{ Variables: { user?: User } }>(
  (() => {
    // Disable auth in test mode
    if (process.env.NODE_ENV === "test") {
      return async (c, next) => {
        c.set("user", {
          email: "test@tabbyml.com",
        } as User);
        await next();
      };
    }

    return async (c, next) => {
      const session = await auth.api.getSession({
        headers: c.req.raw.headers,
        query: {
          disableRefresh: true,
        },
      });
      if (session) {
        c.set("user", session.user);
      }
      await next();
    };
  })(),
);

export const optionalAuth = createMiddleware<{ Variables: { user?: User } }>(
  async (_c, next) => {
    await next();
  },
);

export const requireAuth = (role?: string) =>
  createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Check for role if provided.
    if (role && user.role !== role) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];
