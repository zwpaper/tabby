import type { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { verifyToken } from "./db";

function makeAuthRequest(): MiddlewareHandler {
  // Disable auth in test mode
  if (process.env.NODE_ENV === "test") {
    return async (c, next) => {
      c.set("user", {
        email: "test@tabbyml.com",
      });
      await next();
    };
  }

  return bearerAuth({
    async verifyToken(token, c) {
      const user = await verifyToken(token);
      if (!user) return false;
      c.set("user", user);
      return true;
    },
  });
}

export const authRequest = makeAuthRequest();
