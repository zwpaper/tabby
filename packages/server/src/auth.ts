import { type User, betterAuth } from "better-auth";
import { bearer, emailOTP, magicLink, oAuthProxy } from "better-auth/plugins";
import type { MiddlewareHandler } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import { createMiddleware } from "hono/factory";
import { db } from "./db";

export const auth = betterAuth({
  database: {
    db,
    type: "postgres",
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string,
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
      redirectURI:
        "https://ragdoll-production.up.railway.app/api/auth/callback/github",
    },
  },
  plugins: [
    bearer(),
    oAuthProxy(),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in") {
          return;
        }

        console.log("Sending OTP to", email, otp);
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        console.log(`Magic link: ${email} | ${url}`);
      },
    }),
  ],
});

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
      const headers = new Headers({
        authorization: `Bearer ${token}`,
      });
      const session = await auth.api.getSession({
        headers,
      });
      if (!session) return false;
      c.set("user", session.user);
      return true;
    },
  });
}

export const authRequest = createMiddleware<{ Variables: { user: User } }>(
  makeAuthRequest(),
);
