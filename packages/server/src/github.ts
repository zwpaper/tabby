import type { IncomingMessage, ServerResponse } from "node:http";

import { App, createNodeMiddleware } from "@octokit/app";
import { EventSource } from "eventsource";
import { sql } from "kysely";
import { auth } from "./auth";
import { type DB, db } from "./db";
import { connectToWeb } from "./lib/connect";

const app = new App({
  appId: process.env.GITHUB_APP_ID || "GITHUB_APP_ID is not set",
  privateKey:
    process.env.GITHUB_APP_PRIVATE_KEY?.replaceAll("\\\\n", "\n") ||
    "GITHUB_APP_PRIVATE_KEY is not set",
  oauth: {
    clientId:
      process.env.GITHUB_APP_CLIENT_ID || "GITHUB_APP_CLIENT_ID is not set",
    clientSecret:
      process.env.GITHUB_APP_CLIENT_SECRET ||
      "GITHUB_APP_CLIENT_SECRET is not set",
  },
  webhooks: {
    secret:
      process.env.GITHUB_WEBHOOK_SECRET || "GITHUB_WEBHOOK_SECRET is not set",
  },
});

if (process.env.GITHUB_WEBHOOK_PROXY_URL) {
  const source = new EventSource(process.env.GITHUB_WEBHOOK_PROXY_URL);
  source.onmessage = (event) => {
    const webhookEvent = JSON.parse(event.data);
    app.webhooks
      .verifyAndReceive({
        id: webhookEvent["x-request-id"],
        name: webhookEvent["x-github-event"],
        signature: webhookEvent["x-hub-signature-256"],
        payload: JSON.stringify(webhookEvent.body),
      })
      .catch(console.error);
  };
}

const middleware = createNodeMiddleware(app, { pathPrefix: "/github" });
export default connectToWeb(async (req, res) => {
  const { pathname } = new URL(req.url as string, "http://localhost");
  if (pathname === "/github/oauth/callback" && req.method === "GET") {
    return handleCallback(req, res);
  }
  return middleware(req, res);
});

async function handleCallback(req: IncomingMessage, res: ServerResponse) {
  const { searchParams } = new URL(req.url as string, "http://localhost");
  const query = Object.fromEntries(searchParams) as {
    state?: string;
    scopes?: string;
    code?: string;
    redirectUrl?: string;
    allowSignup?: string;
    error?: string;
    error_description?: string;
    error_url?: string;
  };

  const authData = await auth.api.getSession({
    headers: new Headers(req.headers as Record<string, string>),
    query: {
      disableRefresh: true,
    },
  });
  if (!authData) {
    throw new Error("[github] Not authenticated");
  }

  if (query.error) {
    throw new Error(`[github] ${query.error} ${query.error_description}`);
  }
  if (!query.code) {
    throw new Error('[github] "code" parameter is required');
  }

  const {
    authentication: { token },
  } = await app.oauth.createToken({
    code: query.code,
  });

  const octokit = await app.oauth.getUserOctokit({ token });
  const { data } = await octokit.request("GET /user/installations");

  for (const payload of data.installations) {
    if (payload.app_id === Number(process.env.GITHUB_APP_ID)) {
      const vendorData = JSON.stringify({
        provider: "github",
        integrationId: payload.id.toString(),
        payload,
      } satisfies DB["externalIntegration"]["vendorData"]["__select__"]);
      await db
        .insertInto("externalIntegration")
        .values({
          userId: authData.user.id,
          vendorData,
        })
        .onConflict((oc) =>
          oc
            .expression(
              sql`("vendorData"->>'provider'), ("vendorData"->>'integrationId')`,
            )
            .doUpdateSet({
              userId: authData.user.id,
              vendorData,
            }),
        )
        .execute();
      break;
    }
  }

  // redirect
  res.statusCode = 302;
  res.setHeader("Location", "/integrations?github_connected=true");
  res.end();
  return true;
}
