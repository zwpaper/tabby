import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { admin, bearer, magicLink, oAuthProxy } from "better-auth/plugins";
import { createMiddleware } from "hono/factory";
import { db } from "./db";
import { handleGithubAccountUpdate } from "./github";
import { StripePlans } from "./lib/constants";
import { deviceLink } from "./lib/device-link";
import { resend } from "./lib/resend";
import { stripeClient } from "./lib/stripe";

export const auth = betterAuth({
  user: {
    additionalFields: {
      isWaitlistApproved: {
        type: "boolean",
        default: false,
        required: false,
        input: false,
      },
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({ newEmail, url }) => {
        await resend.emails.send({
          from: "Pochi <noreply@getpochi.com>",
          to: newEmail,
          subject: "Verify your new email",
          html: `<p>Click <a href="${url}">here</a> to verify your new email.</p>`,
        });
      },
    },
  },
  trustedOrigins: [
    "https://www.getpochi.com",
    "https://app.getpochi.com",
    "https://ragdoll-production.up.railway.app",
    "http://localhost:4111",
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60, // 1 hour
    },
  },
  database: {
    db,
    type: "postgres",
  },
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || "GITHUB_CLIENT_ID is not set",
      clientSecret:
        process.env.GITHUB_CLIENT_SECRET || "GITHUB_CLIENT_SECRET is not set",
      redirectURI: "https://app.getpochi.com/api/auth/callback/github",
    },
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID is not set",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET || "GOOGLE_CLIENT_SECRET is not set",
      redirectURI: "https://app.getpochi.com/api/auth/callback/google",
    },
  },
  plugins: [
    admin(),
    bearer(),
    oAuthProxy(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await resend.emails.send({
          from: "Pochi <noreply@getpochi.com>",
          to: email,
          subject: "Login to Pochi",
          html: `Click <a href="${url}">here</a> to login to Pochi.`,
        });
      },
    }),
    deviceLink(),
    stripe({
      stripeClient,
      stripeWebhookSecret:
        process.env.STRIPE_WEBHOOK_SECRET || "STRIPE_WEBHOOK_SECRET is not set",
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: StripePlans,
      },
    }),
  ],
  databaseHooks: {
    account: {
      update: {
        before: async (accountData) => {
          if (accountData.providerId === "github") {
            await handleGithubAccountUpdate(accountData);
          }

          return {
            data: {
              ...accountData,
              updatedAt: new Date(),
            },
          };
        },
      },
    },
  },
});

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
