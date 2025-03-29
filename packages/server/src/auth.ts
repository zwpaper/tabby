import type { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { db } from "./db";

function makeAuthRequest(): MiddlewareHandler {
  if (process.env.DISABLE_AUTH) {
    return async (_, next) => {
      await next();
    };
  }

  return bearerAuth({
    async verifyToken(token) {
      const user = await db.auth.verifyToken(token);
      return !!user;
    },
  });
}

export const authRequest = makeAuthRequest();
