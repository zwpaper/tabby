import type { Server } from "node:http";
import { App, type Installation } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { sql } from "kysely";
import { auth } from "../auth";
import { type DB, db } from "../db";
import { connectToWeb } from "../lib/connect";
import { publishUserEvent } from "../server";

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
        "channels:manage",
        "groups:write",
        "mpim:write",
        "im:write",

        // History.
        "channels:history",
        "groups:history",
        "im:history",
        "mpim:history",
      ],
      installerOptions: {
        authVersion: "v2",
        directInstall: true,
        stateVerification: false,
        callbackOptions: {
          afterInstallation: async (installation, _installOptions, req) => {
            const data = await auth.api.getSession({
              headers: new Headers(req.headers as Record<string, string>),
              query: {
                disableRefresh: true,
              },
            });
            if (!data) return false;

            const vendorIntegrationId =
              installation.enterprise?.id || installation.team?.id;
            if (!vendorIntegrationId) return false;

            const vendorData = JSON.stringify({
              provider: "slack",
              integrationId: vendorIntegrationId,
              payload: installation as Installation<"v2", boolean>,
            } satisfies DB["externalIntegration"]["vendorData"]["__select__"]);
            await db
              .insertInto("externalIntegration")
              .values({
                userId: data.user.id,
                vendorData,
              })
              .onConflict((oc) =>
                oc
                  .expression(
                    sql`("vendorData"->>'provider'), ("vendorData"->>'integrationId')`,
                  )
                  .doUpdateSet({
                    userId: data.user.id,
                    vendorData,
                  }),
              )
              .execute();
            return true;
          },
          success: (_installation, _options, _req, res) => {
            const redirectUri = "/integrations?slack_connected=true";
            res.writeHead(302, { Location: redirectUri });
            res.end();
          },
          failure: (_codeError, _options, _req, res) => {
            const redirectUri = "/integrations?slack_connected=false";
            res.writeHead(302, { Location: redirectUri });
            res.end();
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

          const { vendorData } = await db
            .selectFrom("externalIntegration")
            .select("vendorData")
            .where(sql`"vendorData"->>'provider'`, "=", "slack")
            .where(
              sql`"vendorData"->>'integrationId'`,
              "=",
              vendorIntegrationId,
            )
            .executeTakeFirstOrThrow();

          if (vendorData.provider === "slack") {
            return vendorData.payload;
          }

          throw new Error("Integration is not valid");
        },
        deleteInstallation: async (installQuery) => {
          const vendorIntegrationId =
            installQuery.enterpriseId || installQuery.teamId;
          if (!vendorIntegrationId)
            throw new Error("Integration query is not valid");
          await db
            .deleteFrom("externalIntegration")
            .where(sql`"vendorData"->>'provider'`, "=", "slack")
            .where(
              sql`"vendorData"->>'integrationId'`,
              "=",
              vendorIntegrationId,
            )
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
        .where(sql`"vendorData"->>'provider'`, "=", "slack")
        .where(sql`"vendorData"->>'integrationId'`, "=", vendorIntegrationId)
        .executeTakeFirst();
      if (!integration) return;

      publishUserEvent(integration.userId, {
        type: "slack:message",
        data: message,
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

  async getIntegration(userId: string, vendorIntegrationId?: string) {
    let query = db
      .selectFrom("externalIntegration")
      .select("vendorData")
      .where(sql`"vendorData"->>'provider'`, "=", "slack")
      .where("userId", "=", userId);

    if (vendorIntegrationId) {
      query = query.where(
        sql`"vendorData"->>'integrationId'`,
        "=",
        vendorIntegrationId,
      );
    }

    const result = await query.executeTakeFirst();
    if (!result) return null;

    const { vendorData } = result;

    if (vendorData.provider === "slack") {
      const installation = vendorData.payload as Installation<"v2", boolean>; // Add type assertion
      if (installation.bot?.token) {
        return {
          webClient: new WebClient(
            installation.bot.token,
            this.app.webClientOptions,
          ),
          slackUserId: installation.user.id,
        };
      }
    }
    return null;
  }
}

export const slackService = new SlackService();
