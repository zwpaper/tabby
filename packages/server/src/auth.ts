import { stripe } from "@better-auth/stripe";
import { betterAuth } from "better-auth";
import { bearer, emailOTP, magicLink, oAuthProxy } from "better-auth/plugins";
import { createMiddleware } from "hono/factory";
import Stripe from "stripe";
import { db } from "./db";
import { deviceLink } from "./device-link";

export const auth = betterAuth({
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
  ]
});

function createGithubProvider() {
  return {
    clientId: process.env.GITHUB_CLIENT_ID || "GITHUB_CLIENT_ID is not set",
    clientSecret: process.env.GITHUB_CLIENT_SECRET || "GITHUB_CLIENT_SECRET is not set",
    redirectURI: "https://app.getpochi.com/api/auth/callback/github",
  };
}

function createStripePlugin() {
  const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "STRIPE_SECRET_KEY is not set");
  return stripe({
    stripeClient,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || "STRIPE_WEBHOOK_SECRET is not set",
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

type User = typeof auth.$Infer.Session.user;
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
