import { stripe } from "@better-auth/stripe";
import {
  type GenericEndpointContext,
  type Session,
  betterAuth,
} from "better-auth";
import {
  admin,
  apiKey,
  bearer,
  createAuthMiddleware,
  magicLink,
  oAuthProxy,
} from "better-auth/plugins";

import moment from "moment";
import { db } from "./db";
import { handleGithubAccountUpdate } from "./github";
import { StripePlans } from "./lib/constants";
import { deviceLink } from "./lib/device-link";
import { getWaitlistSignupEmailHtml } from "./lib/email-templates";
import { resend } from "./lib/resend";
import { stripeClient } from "./lib/stripe";

export const auth = betterAuth({
  advanced: {
    // Force use non-secure cookie to ensure oauthProxy can forward cookies to local development server
    useSecureCookies: false,
  },
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
    "http://localhost:4113",
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
        const emailHtml = getWaitlistSignupEmailHtml({
          loginUrl: url,
        });

        await resend.emails.send({
          from: "Pochi <noreply@getpochi.com>",
          to: email,
          subject: "You are on the waitlist - from Pochi!",
          html: emailHtml,
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
      billingPortal: {
        returnUrl: "/profile",
      },
    }),
    apiKey({
      enableMetadata: true,
      customAPIKeyGetter: getApiKey,
    }),
  ],
  databaseHooks: {
    account: {
      update: {
        before: async (accountData, ctx) => {
          if (
            accountData.accessToken?.startsWith("gho_") &&
            accountData.scope?.includes("repo") &&
            ctx
          ) {
            await handleGithubAccountUpdate(
              {
                accessToken: accountData.accessToken,
                scope: accountData.scope,
              },
              ctx,
            );
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
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const key = getApiKey(ctx);
      if (key && ctx.path === "/get-session") {
        // biome-ignore lint/suspicious/noExplicitAny: break type ciruclar dependencies
        const data: any = await (auth as any).api.verifyApiKey({
          body: {
            key,
          },
        });

        if (data.valid && data.key) {
          const { userId } = data.key;
          const user = await ctx.context.internalAdapter.findUserById(userId);
          return ctx.json({
            user,
            session: {
              id: data.key.id,
              token: key,
              userId,
              userAgent: ctx.request?.headers.get("user-agent") ?? null,
              ipAddress: null,
              createdAt: /* @__PURE__ */ new Date(),
              updatedAt: /* @__PURE__ */ new Date(),
              expiresAt:
                data.key.expiresAt || moment().add("7", "days").toDate(),
            } satisfies Session,
          });
        }
      }
    }),
  },
});

function getApiKey(ctx: GenericEndpointContext) {
  const key = ctx.headers?.get("authorization")?.split(" ")[1];
  if (key?.startsWith("pk_")) {
    return key;
  }
  return null;
}
