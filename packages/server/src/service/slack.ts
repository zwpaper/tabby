import type { Server } from "node:http";
import type { DB } from "@ragdoll/db";
import type { ButtonAction } from "@slack/bolt";
import { App, type Installation } from "@slack/bolt";
import { type AnyBlock, WebClient } from "@slack/web-api";
import { sql } from "kysely";
import { auth } from "../better-auth";
import { db, uidCoder } from "../db";
import { connectToWeb } from "../lib/connect";
import { githubService } from "./github";
import { slackTaskService } from "./slack-task";
import { slackModalViewRenderer } from "./slack-task/slack-modal-view";
import { slackRichTextRenderer } from "./slack-task/slack-rich-text";
import { usageService } from "./usage";

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

      // Validate user
      const validation = await this.validateUser(webClient, command.user_id);
      if (!validation.success) {
        await respond({
          text: validation.error,
          blocks: validation.blocks || [],
          response_type: "ephemeral",
        });
        return;
      }

      const { user } = validation;
      if (!user) {
        await respond({
          text: "❌ User validation failed",
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
          userId: user.id,
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
          user,
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

    // Handle button actions
    this.app.action("view_task_button", ({ ack }) => ack());
    this.app.action("get_started_button", ({ ack }) => ack());
    this.app.action("connect_github_button", ({ ack }) => ack());

    // Unified followup/message action handler
    this.app.action(
      /^followup_(.+)$/,
      async ({ action, ack, body, context, client }) => {
        await ack();

        if (action.type !== "button") return;

        const buttonAction = action as ButtonAction;
        const match = buttonAction.action_id.match(/^followup_(.+)$/);
        if (!match) return;

        const [, payload] = match;

        // Parse the payload
        const parsed = slackTaskService.parseFollowupActionPayload(payload);
        if (!parsed) return;

        const { taskId, type, encodedContent } = parsed;

        const vendorIntegrationId = context.teamId || context.enterpriseId;
        if (!vendorIntegrationId) return;

        const webClient =
          await this.getWebClientByIntegration(vendorIntegrationId);
        if (!webClient) return;

        // Validate user (full validation for actions)
        const validation = await this.validateUser(webClient, body.user.id);
        if (!validation.success) {
          await webClient.chat.postEphemeral({
            channel: body.channel?.id || "",
            user: body.user.id,
            text: validation.error || "❌ User validation failed",
            blocks: validation.blocks,
          });
          return;
        }

        const { user: targetUser } = validation;
        if (!targetUser) {
          await webClient.chat.postEphemeral({
            channel: body.channel?.id || "",
            user: body.user.id,
            text: "❌ User validation failed",
          });
          return;
        }

        // Get task belong to current user
        const decodedTaskId = uidCoder.decode(taskId);
        const task = await db
          .selectFrom("task")
          .select(["userId"])
          .where("id", "=", decodedTaskId)
          .executeTakeFirst();

        if (!task) return;

        if (task.userId !== targetUser.id) {
          await webClient.chat.postEphemeral({
            channel: body.channel?.id || "",
            user: body.user.id,
            text: "❌ You can only reply to your own tasks. This task belongs to another user.",
          });
          return;
        }

        const metadata = {
          channel: body.channel?.id || "",
          messageTs: "message" in body && body.message ? body.message.ts : "",
        };

        if (type === "custom") {
          await client.views.open({
            trigger_id: (body as { trigger_id: string }).trigger_id,
            view: slackModalViewRenderer.renderFollowupModal(taskId, metadata),
          });
        } else if (type === "direct") {
          if (!encodedContent) return;

          const content = slackTaskService.decodeContent(encodedContent);
          if (!content) return;

          // Open a modal with prefilled suggestion content
          await client.views.open({
            trigger_id: (body as { trigger_id: string }).trigger_id,
            view: slackModalViewRenderer.renderFollowupModal(
              taskId,
              metadata,
              content,
            ),
          });
        }
      },
    );

    // Handle followup modal submission (both numbered and custom)
    this.app.view(
      /^submit_followup_(.+)$/,
      async ({ ack, body, view, context }) => {
        await ack();

        const match = view.callback_id.match(/^submit_followup_(.+)$/);
        if (!match) return;

        const [, taskId] = match;
        const vendorIntegrationId = context.teamId || context.enterpriseId;
        if (!vendorIntegrationId) return;

        // Get the answer from the modal
        const answer = view.state.values.answer_block.answer_input.value;
        if (!answer) return;

        // Get the user info and validate user
        const webClient =
          await this.getWebClientByIntegration(vendorIntegrationId);
        if (!webClient) return;

        // Validate user (full validation for modal submissions)
        const validation = await this.validateUser(webClient, body.user.id);
        if (!validation.success) {
          // For modal submissions, we can't show blocks, so just show text error
          const channelId = context.channelId;
          if (channelId) {
            await webClient.chat.postEphemeral({
              channel: channelId,
              user: body.user.id,
              text: validation.error || "❌ User validation failed",
            });
          }
          return;
        }

        const { user: targetUser } = validation;
        if (!targetUser) {
          const channelId = context.channelId;
          if (channelId) {
            await webClient.chat.postEphemeral({
              channel: channelId,
              user: body.user.id,
              text: "❌ User validation failed",
            });
          }
          return;
        }

        // Parse metadata from modal
        const metadata = view.private_metadata
          ? JSON.parse(view.private_metadata)
          : null;

        // Handle the followup action
        const result = await slackTaskService.handleFollowupAction({
          taskId,
          content: answer,
          userId: targetUser.id,
          channel: metadata?.channel,
          messageTs: metadata?.messageTs,
        });

        // Send error message if submission failed (success messages are handled in SlackTaskService)
        if (!result.success) {
          const channelId = metadata?.channel || context.channelId;
          if (channelId) {
            await webClient.chat.postEphemeral({
              channel: channelId,
              user: body.user.id,
              text: `❌ Failed to submit: ${result.error}`,
            });
          }
        }
      },
    );
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

  /**
   * Validates user existence, waitlist approval, and GitHub connection
   */
  private async validateUser(
    webClient: WebClient,
    userId: string,
  ): Promise<{
    success: boolean;
    user?: User;
    userEmail?: string;
    error?: string;
    blocks?: AnyBlock[];
  }> {
    const userInfo = await webClient.users.info({ user: userId });

    if (!userInfo.ok || !userInfo.user?.profile?.email) {
      return {
        success: false,
        error:
          "❌ Unable to get your email from Slack. Please ensure your email is set in your Slack profile.",
      };
    }
    const userEmail = userInfo.user.profile.email;

    // Check if user exists in database
    const targetUser = await db
      .selectFrom("user")
      .selectAll()
      .where("email", "=", userEmail)
      .executeTakeFirst();

    if (!targetUser) {
      return {
        success: false,
        blocks: slackRichTextRenderer.renderWaitlistApprovalRequired(userEmail),
      };
    }

    const limits = await usageService.readCurrentMonthQuota(targetUser as User);
    if (limits.credit.isLimitReached) {
      return {
        success: false,
        blocks: slackRichTextRenderer.renderCreditLimitReached(),
      };
    }

    // Check GitHub connection
    const hasGithubConnection = await githubService.checkConnection(
      targetUser.id,
    );
    if (!hasGithubConnection) {
      return {
        success: false,
        blocks: slackRichTextRenderer.renderGitHubConnectionRequired(userEmail),
      };
    }

    return {
      success: true,
      user: targetUser as User,
      userEmail,
    };
  }
}

export const slackService = new SlackService();
