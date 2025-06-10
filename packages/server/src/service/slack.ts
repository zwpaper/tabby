import type { Server } from "node:http";
import type { DB } from "@ragdoll/db";
import { App, type Installation, LogLevel } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { sql } from "kysely";
import { auth } from "../auth";
import { db } from "../db";
import { connectToWeb } from "../lib/connect";
import { githubService } from "./github";
import { slackTaskService } from "./slack-task";

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
        "im:read",
        "users:read.email",

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

    if (
      process.env.NODE_ENV === "production" ||
      !!process.env.POCHI_SLACK_DEV
    ) {
      // @ts-expect-error
      this.app.receiver.client.start().then(() => this.registerEvents());
    }
  }

  private registerEvents() {
    // Handle slash commands for task creation
    this.app.command("/newtask", async ({ command, ack, respond, context }) => {
      // Acknowledge the command request
      await ack();

      // Check if command is used in DM
      const isDM =
        command.channel_name === "directmessage" ||
        command.channel_id.startsWith("D");

      if (!isDM) {
        await respond({
          text: "❌ The `/newtask` command can only be used in direct messages. Please send me a DM to create tasks.",
          response_type: "ephemeral",
        });
        return;
      }

      const vendorIntegrationId = context.teamId || context.enterpriseId;
      if (!vendorIntegrationId) return;

      const integration = await db
        .selectFrom("externalIntegration")
        .select("userId")
        .where(sql`"vendorData"->>'provider'`, "=", "slack")
        .where(sql`"vendorData"->>'integrationId'`, "=", vendorIntegrationId)
        .executeTakeFirst();

      if (!integration) return;

      // Get user email from Slack and find corresponding userId
      const userEmail = await this.getUserEmail(
        integration.userId,
        vendorIntegrationId,
        command.user_id,
      );

      if (!userEmail) {
        await respond({
          text: "❌ Unable to get your email from Slack. Please ensure your email is set in your Slack profile.",
          response_type: "ephemeral",
        });
        return;
      }

      // Find user by email
      const targetUser = await db
        .selectFrom("user")
        .select(["id", "email", "name"])
        .where("email", "=", userEmail)
        .executeTakeFirst();

      if (!targetUser) {
        await respond({
          text: `❌ No user found with email ${userEmail}. Please make sure you have an account on Pochi.`,
          response_type: "ephemeral",
        });
        return;
      }

      const hasGithubConnection = await githubService.checkConnection(
        targetUser.id,
      );
      if (!hasGithubConnection) {
        await respond({
          text: "❌ You need to connect your GitHub account first. Please visit your Pochi settings to connect GitHub.",
          response_type: "ephemeral",
        });
        return;
      }

      const taskText = command.text?.trim();
      if (!taskText) {
        await respond({
          text: "❌ Please provide a task description. Usage: `/newtask repo description`\nExample: `/newtask TabbyML/ragdoll please fix issue 5723`",
          response_type: "ephemeral",
        });
        return;
      }

      try {
        await slackTaskService.createTaskWithCloudRunner(
          targetUser.id,
          command,
          taskText,
        );
        await respond({
          text: "✅ GitHub task created with cloud runner!",
          response_type: "ephemeral",
        });
      } catch (error) {
        await respond({
          text: `❌ ${error instanceof Error ? error.message : "Invalid command format"}. Usage: \`/newtask repo description\`\nExample: \`/newtask TabbyML/ragdoll please fix issue 5723\``,
          response_type: "ephemeral",
        });
      }
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

  /**
   * Get user email from Slack using the authenticated WebClient
   */
  async getUserEmail(
    ownerId: string,
    vendorIntegrationId: string,
    slackUserId: string,
  ) {
    const integration = await this.getIntegration(ownerId, vendorIntegrationId);

    if (!integration?.webClient) {
      console.error("No authenticated Slack integration found for user");
      return undefined;
    }

    const userInfo = await integration.webClient.users.info({
      user: slackUserId,
    });

    if (!userInfo.ok) {
      console.error("Failed to get Slack user info:", userInfo.error);
      return undefined;
    }
    if (!userInfo.user?.profile?.email) {
      console.warn("Slack user does not have an email address set");
      return undefined;
    }

    return userInfo.user.profile.email;
  }
}

export const slackService = new SlackService();
