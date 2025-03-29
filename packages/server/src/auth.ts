import type { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { db } from "./db";

function makeAuthRequest(): MiddlewareHandler {
  if (process.env.RAGDOLL_ENABLE_AUTH) {
    return bearerAuth({
      async verifyToken(token) {
        const user = await db().auth.verifyToken(token);
        return !!user;
      },
    });
  }

  return async (_, next) => {
    await next();
  };
}

export const authRequest = makeAuthRequest();
