import { stripe } from "@better-auth/stripe";
import { type BetterAuthPlugin, type User, betterAuth } from "better-auth";
import { bearer, emailOTP, magicLink, oAuthProxy } from "better-auth/plugins";
import { createMiddleware } from "hono/factory";
import Stripe from "stripe";
import { db } from "./db";
import { deviceLink } from "./device-link";

export const auth = betterAuth({
  database: {
    db,
    type: "postgres",
  },
  socialProviders: {
    github: createGithubProvider(),
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
    deviceLink(),
    createStripePlugin(),
  ].filter(Boolean) as BetterAuthPlugin[],
});

function createGithubProvider() {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn("Github is not configured");
    return undefined;
  }
  return {
    clientId: process.env.GITHUB_CLIENT_ID as string,
    clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    redirectURI: "https://app.getpochi.com/api/auth/callback/github",
  };
}

function createStripePlugin() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("Stripe is not configured");
    return null;
  }

  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripe({
    stripeClient,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    createCustomerOnSignUp: true,
    subscription: {
      enabled: true,
      plans: [
        {
          name: "Pro",
          priceId: "price_0987654321",
        },
      ],
    },
  });
}

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
      const session = await auth.api.getSession({ headers: c.req.raw.headers });
      if (session) {
        c.set("user", session.user);
      }
      await next();
    };
  })(),
);

export const requireAuth = createMiddleware<{ Variables: { user: User } }>(
  async (c, next) => {
    const user = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  },
);
