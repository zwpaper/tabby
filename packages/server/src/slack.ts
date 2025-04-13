import type { Server } from "node:http";
import { App } from "@slack/bolt";
import type { Installation } from "@slack/oauth";
import { auth } from "./auth";
import { db } from "./db";
import type { JsonObject, JsonValue } from "./db/schema";
import { connectToWeb } from "./lib/connect";
import { publishUserEvent } from "./server";

class SlackService {
  private app: App;

  constructor() {
    this.app = new App({
      // logLevel: LogLevel.DEBUG,
      signingSecret: process.env.SLACK_SIGNING_SECRET,
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET,
      stateSecret: process.env.SLACK_STATE_SECRET,
      appToken: process.env.SLACK_APP_TOKEN,
      // token: process.env.SLACK_BOT_TOKEN,
      socketMode: true,
      scopes: [
        // Basics.
        "app_mentions:read",
        "channels:read",
        "users:read",

        // sendMessage / reaction.
        "chat:write",
        "reactions:write",

        // History.
        "channels:history",
        "groups:history",
        "im:history",
        "mpim:history",
      ],
      installerOptions: {
        authVersion: "v2",
        directInstall: true,
        installPath: "/slack/installations",
        stateVerification: false,
        callbackOptions: {
          afterInstallation: async (installation, _installOptions, req) => {
            const data = await auth.api.getSession({
              headers: new Headers(req.headers as Record<string, string>),
            });
            if (!data) return false;

            const vendorIntegrationId =
              installation.enterprise?.id || installation.team?.id;
            if (!vendorIntegrationId) return false;

            const payload = installation as unknown as JsonObject;
            await db
              .insertInto("externalIntegration")
              .values({
                provider: "slack",
                userId: data.user.id,
                vendorIntegrationId,
                payload,
              })
              .onConflict((oc) =>
                oc.columns(["provider", "vendorIntegrationId"]).doUpdateSet({
                  userId: data.user.id,
                  payload,
                }),
              )
              .execute();
            return true;
          },
        },
      },
      installationStore: {
        storeInstallation: async () => {
          // do nothing, installed to db in `afterInstallation`.
        },
        fetchInstallation: async (installQuery) => {
          const vendorIntegrationId =
            installQuery.enterpriseId || installQuery.teamId;
          if (!vendorIntegrationId)
            throw new Error("Integration query is not valid");

          let installation: JsonValue | undefined;
          installation = await db
            .selectFrom("externalIntegration")
            .select("payload")
            .where("provider", "=", "slack")
            .where("vendorIntegrationId", "=", vendorIntegrationId)
            .executeTakeFirst();

          if (installation) {
            return installation as unknown as Installation<"v2", boolean>;
          }

          throw new Error("Failed fetching installation");
        },
        deleteInstallation: async (installQuery) => {
          const vendorIntegrationId =
            installQuery.enterpriseId || installQuery.teamId;
          if (!vendorIntegrationId)
            throw new Error("Integration query is not valid");
          await db
            .deleteFrom("externalIntegration")
            .where("provider", "=", "slack")
            .where("vendorIntegrationId", "=", vendorIntegrationId)
            .execute();
        },
      },
    });

    // @ts-expect-error
    this.app.receiver.client.start().then(() => this.registerEvents());
  }

  private registerEvents() {
    this.app.message(/.*/, async ({ context, message }) => {
      const vendorIntegrationId = context.teamId || context.enterpriseId;
      if (!vendorIntegrationId) return;
      const integration = await db
        .selectFrom("externalIntegration")
        .select("userId")
        .where("provider", "=", "slack")
        .where("vendorIntegrationId", "=", vendorIntegrationId)
        .executeTakeFirst();
      if (!integration) return;

      publishUserEvent(integration.userId, {
        type: "slack:message",
        payload: message,
      });
    });
  }

  async handler(req: Request) {
    const func = connectToWeb((req, res) => {
      // @ts-expect-error
      const server = this.app.receiver.httpServer as Server;
      server.emit("request", req, res);
    });

    const resp = await func(req);
    if (resp) {
      return resp;
    }
  }
}

export default new SlackService();
