import type { Server } from "node:http";
import { getLogger } from "@getpochi/common";
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import type { DB } from "@ragdoll/db";
import type { ButtonAction } from "@slack/bolt";
import { App, type Installation } from "@slack/bolt";
import { type AnyBlock, WebClient } from "@slack/web-api";
import { sql } from "kysely";
import { auth } from "../better-auth";
import { db, uidCoder } from "../db";
import { connectToWeb } from "../lib/connect";
import { metrics } from "../metrics";
import { spanConfig } from "../trace";
import { githubService } from "./github";
import { slackTaskService } from "./slack-task";
import { slackModalViewRenderer } from "./slack-task/slack-modal-view";
import { slackRichTextRenderer } from "./slack-task/slack-rich-text";
import { usageService } from "./usage";

const tracer = trace.getTracer("ragdoll.slack", "0.0.1");
const logger = getLogger("SlackService");

export const withSpan = async <T>(
  operationName: string,
  func: (span: Span) => Promise<T>,
): Promise<T | undefined> => {
  return tracer.startActiveSpan(operationName, async (span) => {
    try {
      return await func(span);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
    } finally {
      span.end();
    }
  });
};

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

    if (process.env.SLACK_EVENTS_MODE === "on") {
      // @ts-expect-error
      this.app.receiver.client.start().then(() => this.registerEvents());
    }
  }

  private registerEvents() {
    // Handle slash commands for task creation
    this.app.command(
      "/newtask",
      async ({ command, ack, respond, context }) =>
        await withSpan("slack.newTask", async (span) => {
          metrics.counter.slackCommandsTotal.add(1, {
            command: "newtask",
            status: "received",
          });

          await ack();

          const vendorIntegrationId = context.teamId || context.enterpriseId;
          if (!vendorIntegrationId) {
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "no_integration",
            });
            return;
          }

          const webClient =
            await this.getWebClientByIntegration(vendorIntegrationId);
          if (!webClient) return;

          const validation = await this.validateUser(
            webClient,
            command.user_id,
          );
          if (!validation.success) {
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "validation_failed",
            });
            await respond({
              text: validation.error,
              blocks: validation.blocks || [],
              response_type: "ephemeral",
            });
            return;
          }

          const { user } = validation;
          if (!user) {
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "validation_failed",
            });
            await respond({
              text: "❌ User validation failed",
              blocks: validation.blocks || [],
              response_type: "ephemeral",
            });
            return;
          }
          spanConfig.setAttribute("ragdoll.user.email", user.email, span);

          const taskText = command.text?.trim();
          if (!taskText) {
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "no_description",
            });
            await respond({
              text: "❌ Please provide a task description. Usage:\n• `/newtask [owner/repo] description`\n• Or `/newtask description` (if channel topic contains `[repo:owner/repo]`)\n\nExample: `/newtask [TabbyML/tabby] fix the login issue`\nOr set channel topic: `Project discussion [repo:TabbyML/tabby]` and use: `/newtask fix the login issue`",
              response_type: "ephemeral",
            });
            return;
          }

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
            // const uid = await slackTaskService.createTaskWithCloudRunner(
            //   user,
            //   command,
            //   taskText,
            //   command.user_id,
            // );
            const uid = undefined;
            if (!uid) {
              throw new Error("Failed to create task");
            }
            spanConfig.setAttribute("ragdoll.task.uid", uid, span);
            metrics.counter.slackTasksCreated.add(1);
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "success",
            });
          } catch (error) {
            logger.error("Failed to create slack task:", error);
            metrics.counter.slackCommandsTotal.add(1, {
              command: "newtask",
              status: "error",
            });
            await respond({
              text: `❌ ${error instanceof Error ? error.message : "Invalid command format"}. Usage:\n• \`/newtask [owner/repo] description\`\n• Or \`/newtask description\` (if channel topic contains \`[repo:owner/repo]\`)\n\nExample: \`/newtask [TabbyML/tabby] fix the login issue\``,
              response_type: "ephemeral",
            });
            throw error; // Re-throw to trigger span error handling
          }
        }),
    );

    // Handle button actions
    this.app.action("view_task_button", ({ ack }) => ack());
    this.app.action("get_started_button", ({ ack }) => ack());
    this.app.action("connect_github_button", ({ ack }) => ack());

    // Unified followup/message action handler
    this.app.action(
      /^followup_(.+)$/,
      async ({ action, ack, body, context, client }) =>
        await withSpan("slack.followupAction", async (span) => {
          metrics.counter.slackFollowupActions.add(1, {
            type: "received",
            status: "processing",
          });
          await ack();

          if (action.type !== "button") {
            metrics.counter.slackFollowupActions.add(1, {
              type: "invalid",
              status: "error",
            });
            return;
          }

          const buttonAction = action as ButtonAction;
          const match = buttonAction.action_id.match(/^followup_(.+)$/);
          if (!match) {
            metrics.counter.slackFollowupActions.add(1, {
              type: "invalid",
              status: "error",
            });
            return;
          }

          const [, payload] = match;

          const parsed = slackTaskService.parseFollowupActionPayload(payload);
          if (!parsed) return;

          const { taskId, type, encodedContent } = parsed;
          spanConfig.setAttribute("ragdoll.task.uid", parsed.taskId, span);

          const vendorIntegrationId = context.teamId || context.enterpriseId;
          if (!vendorIntegrationId) return;

          const webClient =
            await this.getWebClientByIntegration(vendorIntegrationId);
          if (!webClient) return;

          const validation = await this.validateUser(webClient, body.user.id);
          if (!validation.success) {
            metrics.counter.slackFollowupActions.add(1, {
              type: "validation_failed",
              status: "error",
            });
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
          spanConfig.setAttribute("ragdoll.user.email", targetUser.email, span);

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
            metrics.counter.slackFollowupActions.add(1, {
              type: "custom",
              status: "success",
            });
            await client.views.open({
              trigger_id: (body as { trigger_id: string }).trigger_id,
              view: slackModalViewRenderer.renderFollowupModal(
                taskId,
                metadata,
              ),
            });
          } else if (type === "direct") {
            if (!encodedContent) {
              metrics.counter.slackFollowupActions.add(1, {
                type: "direct",
                status: "error",
              });
              return;
            }

            const content = slackTaskService.decodeContent(encodedContent);
            if (!content) {
              metrics.counter.slackFollowupActions.add(1, {
                type: "direct",
                status: "error",
              });
              return;
            }

            metrics.counter.slackFollowupActions.add(1, {
              type: "direct",
              status: "success",
            });
            await client.views.open({
              trigger_id: (body as { trigger_id: string }).trigger_id,
              view: slackModalViewRenderer.renderFollowupModal(
                taskId,
                metadata,
                content,
              ),
            });
          }
        }),
    );

    // Handle followup modal submission (both numbered and custom)
    this.app.view(
      /^submit_followup_(.+)$/,
      async ({ ack, body, view, context }) =>
        await withSpan("slack.submitFollowupView", async (span) => {
          await ack();

          const match = view.callback_id.match(/^submit_followup_(.+)$/);
          if (!match) return;

          const [, taskId] = match;
          const vendorIntegrationId = context.teamId || context.enterpriseId;
          if (!vendorIntegrationId) return;
          spanConfig.setAttribute("ragdoll.task.uid", taskId, span);

          const answer = view.state.values.answer_block.answer_input.value;
          if (!answer) return;

          const webClient =
            await this.getWebClientByIntegration(vendorIntegrationId);
          if (!webClient) return;

          const validation = await this.validateUser(webClient, body.user.id);
          if (!validation.success) {
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
          spanConfig.setAttribute("ragdoll.user.email", targetUser.email, span);

          const metadata = view.private_metadata
            ? JSON.parse(view.private_metadata)
            : null;

          const result = await slackTaskService.handleFollowupAction({
            taskId,
            content: answer,
            userId: targetUser.id,
            channel: metadata?.channel,
            messageTs: metadata?.messageTs,
          });

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
        }),
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
   * Validates user existence, and GitHub connection
   */
  private async validateUser(
    webClient: WebClient,
    userId: string,
  ): Promise<{
    success: boolean;
    user?: {
      id: string;
      email: string;
      name: string;
    };
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
      .select(["id", "email", "name", "emailVerified"])
      .where("email", "=", userEmail)
      .executeTakeFirst();

    if (!targetUser) {
      return {
        success: false,
        blocks: slackRichTextRenderer.renderWaitlistApprovalRequired(userEmail),
      };
    }

    const limits = await usageService.readCurrentMonthQuota(targetUser);
    if (
      limits.credit.isLimitReached &&
      !(targetUser.email.endsWith("@tabbyml.com") && targetUser.emailVerified)
    ) {
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
      user: targetUser,
      userEmail,
    };
  }
}

export const slackService = new SlackService();
