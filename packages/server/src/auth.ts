import type { Organization } from "better-auth/plugins";
import { createMiddleware } from "hono/factory";
import { auth } from "./better-auth";

export const authRequest = createMiddleware<{ Variables: { user?: User } }>(
  (() => {
    // Disable auth in test mode
    if (process.env.NODE_ENV === "test") {
      return async (c, next) => {
        c.set("user", {
          email: "test@foo.com",
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

export const requireAuth = (
  opts?: string | { role?: string; internal?: boolean },
) =>
  createMiddleware<{ Variables: { user: User } }>(async (c, next) => {
    if (typeof opts === "string") {
      // biome-ignore lint/style/noParameterAssign: simplify the code
      opts = { role: opts };
    }
    const { role, internal } = opts ?? {};

    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Check for role if provided.
    if (role && user.role !== role) {
      return c.json({ error: "Forbidden" }, 403);
    }
    if (internal && !isInternalUser(user)) {
      return c.json({ error: "Forbidden" }, 403);
    }
    await next();
  });

export type Session = typeof auth.$Infer.Session;
export type User = Session["user"];

export function isInternalUser(user: User) {
  return (
    (user.email.endsWith("@tabbyml.com") ||
      // Ruofan (intern)
      user.email === "2953096035@qq.com") &&
    user.emailVerified
  );
}

export function isInternalOrganization(org: Organization) {
  return org.slug === "tabbyml";
}
