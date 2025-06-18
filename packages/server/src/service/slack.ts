import type { Server } from "node:http";
import type { DB } from "@ragdoll/db";
import { App, type Installation } from "@slack/bolt";
import { WebClient } from "@slack/web-api";
import { sql } from "kysely";
import { auth } from "../better-auth";
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
        "groups:read",
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

        // Commands.
        "commands",
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
            const redirectUri = "/profile?slack_connected=true";
            res.writeHead(302, { Location: redirectUri });
            res.end();
          },
          failure: (_codeError, _options, _req, res) => {
            const redirectUri = "/profile?slack_connected=false";
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
            .executeTakeFirstOrThrow()
            .catch(() => {
              throw new Error(`Integration ${vendorIntegrationId} not found`);
            });

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

      const vendorIntegrationId = context.teamId || context.enterpriseId;
      if (!vendorIntegrationId) return;

      const webClient =
        await this.getWebClientByIntegration(vendorIntegrationId);

      if (!webClient) return;

      const userInfo = await webClient.users.info({
        user: command.user_id,
      });

      if (!userInfo.ok || !userInfo.user?.profile?.email) {
        await respond({
          text: "❌ Unable to get your email from Slack. Please ensure your email is set in your Slack profile.",
          response_type: "ephemeral",
        });
        return;
      }
      const userEmail = userInfo.user.profile.email;

      // get the target email of the user
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
          text: "❌ Please provide a task description. Usage:\n• `/newtask [owner/repo] description`\n• Or `/newtask description` (if channel topic contains `[repo:owner/repo]`)\n\nExample: `/newtask [TabbyML/tabby] fix the login issue`\nOr set channel topic: `Project discussion [repo:TabbyML/tabby]` and use: `/newtask fix the login issue`",
          response_type: "ephemeral",
        });
        return;
      }

      // Update SlackConnect mapping
      await db
        .insertInto("slackConnect")
        .values({
          userId: targetUser.id,
          vendorIntegrationId,
        })
        .onConflict((oc) =>
          oc.column("userId").doUpdateSet({
            vendorIntegrationId,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          }),
        )
        .execute();

      try {
        await slackTaskService.createTaskWithCloudRunner(
          targetUser.id,
          command,
          taskText,
          command.user_id,
        );
      } catch (error) {
        await respond({
          text: `❌ ${error instanceof Error ? error.message : "Invalid command format"}. Usage:\n• \`/newtask [owner/repo] description\`\n• Or \`/newtask description\` (if channel topic contains \`[repo:owner/repo]\`)\n\nExample: \`/newtask [TabbyML/tabby] fix the login issue\``,
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

  private async getInstallation(vendorIntegrationId: string) {
    const result = await db
      .selectFrom("externalIntegration")
      .select("vendorData")
      .where(sql`"vendorData"->>'provider'`, "=", "slack")
      .where(sql`"vendorData"->>'integrationId'`, "=", vendorIntegrationId)
      .executeTakeFirst();

    if (!result) return null;

    const { vendorData } = result;

    return vendorData.payload as Installation<"v2", boolean>;
  }

  private async getInstallationByUser(userId: string) {
    const result = await db
      .selectFrom("slackConnect")
      .innerJoin("externalIntegration", (join) =>
        join.on(
          sql`"externalIntegration"."vendorData"->>'integrationId'`,
          "=",
          sql`"slackConnect"."vendorIntegrationId"`,
        ),
      )
      .select("externalIntegration.vendorData")
      .where("slackConnect.userId", "=", userId)
      .where(sql`"externalIntegration"."vendorData"->>'provider'`, "=", "slack")
      .executeTakeFirst();

    if (!result) return null;

    const { vendorData } = result;

    return vendorData.payload as Installation<"v2", boolean>;
  }

  private getWebClient(installation: Installation<"v2", boolean>) {
    if (!installation.bot?.token) {
      return null;
    }
    return new WebClient(installation.bot.token, this.app.webClientOptions);
  }

  async getWebClientByIntegration(vendorIntegrationId: string) {
    const installation = await this.getInstallation(vendorIntegrationId);
    if (!installation) return null;

    return this.getWebClient(installation);
  }

  async getWebClientByUser(userId: string) {
    const installation = await this.getInstallationByUser(userId);
    if (!installation) return null;

    return this.getWebClient(installation);
  }
}

export const slackService = new SlackService();
