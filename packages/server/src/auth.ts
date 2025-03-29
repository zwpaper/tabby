import { bearerAuth } from "hono/bearer-auth";
import { db } from "./db";
import type { MiddlewareHandler } from "hono";

function makeAuthRequest(): MiddlewareHandler {
    if (process.env.DISABLE_AUTH) {
        return async (c, next) => {
            await next();
        }
    } else {
        return bearerAuth({
            async verifyToken(token, c) {
                const user = await db.auth.verifyToken(token);
                return !!user;
            },
        })

    }
}

export const authRequest = makeAuthRequest()