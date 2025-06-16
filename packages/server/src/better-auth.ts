import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { admin, bearer, magicLink, oAuthProxy } from "better-auth/plugins";

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
    }),
    // apiKey({
    //   enableMetadata: true,
    //   customAPIKeyGetter: (ctx) => {
    //     const key = ctx.headers?.get("authorization")?.split(" ")[1];
    //     if (key?.startsWith("pk_")) {
    //       return key;
    //     }
    //     return null;
    //   },
    // }),
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
});
