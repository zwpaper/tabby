import type { DBMessage, TaskCreateEvent } from "@ragdoll/db";
import type { AnyBlock, WebClient } from "@slack/web-api";

import type { Todo } from "@getpochi/tools";
import { getLogger } from "@ragdoll/common";
import { parseOwnerAndRepo } from "@ragdoll/common/git-utils";
import { enqueueNotifyTaskSlack } from "../background-job";
import { githubService } from "../github";
import { slackService } from "../slack";
import { taskService } from "../task";
import {
  type TaskRenderContext,
  slackRichTextRenderer,
} from "./slack-rich-text";

type Task = NonNullable<Awaited<ReturnType<(typeof taskService)["get"]>>>;

const SLACK_ERROR_REACTED = "already_reacted";
const SLACK_ERROR_NO_REACTION = "no_reaction";

const logger = getLogger("SlackTaskService");

class SlackTaskService {
  async notifyTaskStatusUpdate(userId: string, uid: string): Promise<void> {
    const task = await taskService.get(uid, userId);
    if (!task || !isNotifyableTask(task)) {
      return;
    }

    return await this.sendTaskStatusUpdate(userId, task);
  }

  private async sendTaskStatusUpdate(
    userId: string,
    task: Task,
  ): Promise<void> {
    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      throw new Error("Slack web client or event data is missing");
    }

    // Extract values after null check to ensure TypeScript knows they're defined
    const channel = slackEventData.channel;
    const ts = slackEventData.ts;

    const headerInfo = this.extractHeaderInfoFromTask(task);
    const taskStats = this.extractTaskStatistics(task);

    // Create context object
    const context: TaskRenderContext = {
      headerInfo: {
        prompt: headerInfo.prompt,
        githubRepository: headerInfo.githubRepository,
        slackUserId: headerInfo.slackUserId,
      },
      task: {
        uid: task.uid,
        todos: task.todos,
        conversation: task.conversation,
      },
      stats: {
        requestsCount: taskStats.requestsCount,
        totalTokens: taskStats.totalTokens,
      },
    };

    let blocks: AnyBlock[];
    let text: string;
    let postAction: (() => Promise<void>) | undefined;

    switch (task.status) {
      case "completed": {
        const completionResult = this.extractCompletionResult(
          task.conversation?.messages,
        );
        blocks = slackRichTextRenderer.renderTaskComplete(
          context,
          completionResult || "Task completed successfully.",
        );
        text = "Task completed";
        postAction = () => this.addCompletionReaction(webClient, channel, ts);
        break;
      }

      case "failed": {
        const errorInfo = this.extractErrorInformation(task);
        blocks = slackRichTextRenderer.renderTaskFailed(
          context,
          errorInfo.message,
        );
        text = "Task failed";
        postAction = () =>
          this.removeCompletionReaction(webClient, channel, ts);
        break;
      }

      // @ts-expect-error: fall through to render task running if pending-input is not a askFollowUpQuestion tool call.
      // biome-ignore lint/suspicious/noFallthroughSwitchClause: same as above
      case "pending-input": {
        const askFollowUpQuestion = this.extractAskFollowUpQuestion(task);
        if (askFollowUpQuestion) {
          blocks = slackRichTextRenderer.renderTaskAskFollowUpQuestion(
            context,
            askFollowUpQuestion.question,
            askFollowUpQuestion.followUp,
          );
          text = "Need user input";
          break;
        }
      }
      case "streaming":
      case "pending-model":
      case "pending-tool": {
        blocks = slackRichTextRenderer.renderTaskRunning(context);
        text = "Task running";
        postAction = () =>
          this.removeCompletionReaction(webClient, channel, ts);
        break;
      }
      default: {
        throw task.status satisfies never;
      }
    }

    logger.info(
      `Updating slack message to ${text} while task status is ${task.status}`,
    );
    await webClient.chat.update({
      channel,
      ts,
      text,
      blocks,
    });

    if (postAction) {
      await postAction();
    }

    return;
  }

  private async addCompletionReaction(
    client: WebClient,
    channel: string,
    ts: string,
  ) {
    try {
      await client.reactions.add({
        channel: channel,
        timestamp: ts,
        name: "white_check_mark",
      });
    } catch (error) {
      // Only ignore if reaction already exists
      if (this.isSlackError(error, SLACK_ERROR_REACTED)) {
        return;
      }
      throw error;
    }
  }

  private isSlackError(error: unknown, kind: string): boolean {
    return (
      typeof error === "object" &&
      error !== null &&
      "data" in error &&
      typeof error.data === "object" &&
      error.data !== null &&
      "error" in error.data &&
      error.data.error === kind
    );
  }

  private async removeCompletionReaction(
    client: WebClient,
    channel: string,
    ts: string,
  ) {
    try {
      await client.reactions.remove({
        channel: channel,
        timestamp: ts,
        name: "white_check_mark",
      });
    } catch (error) {
      if (this.isSlackError(error, SLACK_ERROR_NO_REACTION)) {
        return;
      }
      throw error;
    }
  }

  /**
   * Send created task message to slack and return message timestamp
   */
  private async sendCreatedTaskMessage(
    userId: string,
    prompt: string,
    githubRepository: { owner: string; repo: string },
    channelId: string,
    slackUserId: string,
  ): Promise<{ ts: string } | null> {
    const webClient = await slackService.getWebClientByUser(userId);
    if (!webClient) return null;

    const blocks = slackRichTextRenderer.renderTaskCreated(
      prompt,
      githubRepository,
      slackUserId,
    );

    const messageResult = await webClient.chat.postMessage({
      channel: channelId,
      text: "Task created",
      blocks,
    });

    if (!messageResult.ok || !messageResult.ts) {
      logger.error("Failed to post GitHub task message", messageResult.error);
      return null;
    }

    return {
      ts: messageResult.ts,
    };
  }

  /**
   * Create a GitHub repository task with cloud runner (E2B)
   */
  async createTaskWithCloudRunner(
    user: { id: string; name: string; email: string },
    command: { channel_id: string; user_id: string; text?: string },
    taskText: string,
    slackUserId: string,
  ) {
    const webClient = await slackService.getWebClientByUser(user.id);
    if (!webClient) return;

    const githubToken = await githubService.getAccessToken(user.id);
    if (!githubToken) {
      return;
    }

    const parsedCommand = await this.parseTaskCommand(
      taskText,
      webClient,
      command.channel_id,
      githubToken,
      slackUserId,
    );

    if (!parsedCommand) {
      return;
    }

    const taskPrompt = parsedCommand.description;

    const slackInfo = await this.sendCreatedTaskMessage(
      user.id,
      taskPrompt,
      parsedCommand.githubRepository,
      command.channel_id,
      slackUserId,
    );

    if (!slackInfo?.ts) {
      logger.error("Failed to send slack message");
      return;
    }

    const slackEvent: Extract<TaskCreateEvent, { type: "slack:new-task" }> = {
      type: "slack:new-task",
      data: {
        channel: command.channel_id,
        ts: slackInfo.ts,
        prompt: taskPrompt,
        slackUserId: slackUserId,
        githubRepository: parsedCommand.githubRepository,
      },
    };

    const { uid } = await taskService.createWithRunner({
      user,
      prompt: taskPrompt,
      event: slackEvent,
      githubRepository: parsedCommand.githubRepository,
    });

    // Get the created task to retrieve todos
    const task = await taskService.get(uid, user.id);

    await this.sendTaskStarting({
      userId: user.id,
      prompt: taskPrompt,
      event: slackEvent,
      slackUserId,
      githubRepository: parsedCommand.githubRepository,
      taskId: uid,
      todos: task?.todos,
    });

    return uid;
  }

  /**
   * Extract repository information from channel topic
   * Looks for patterns like [repo:owner/repo] in the topic
   */
  private async extractRepoFromChannelTopic(
    webClient: WebClient,
    channelId: string,
  ): Promise<{ owner: string; repo: string } | null> {
    try {
      const channelInfo = await webClient.conversations.info({
        channel: channelId,
      });

      if (!channelInfo.ok || !channelInfo.channel?.topic?.value) {
        return null;
      }

      const topic = channelInfo.channel.topic.value;
      // Look for patterns like [repo:owner/repo] in the topic
      const repoMatch = topic.match(/\[repo:([^/]+\/[^\]]+)\]/i);

      if (!repoMatch) {
        return null;
      }

      const repository = repoMatch[1];
      const ownerAndRepo = parseOwnerAndRepo(repository);

      if (!ownerAndRepo) {
        return null;
      }

      return ownerAndRepo;
    } catch (error) {
      logger.error("Error extracting repo from channel topic", error);
      return null;
    }
  }

  /**
   * Parse GitHub repository task command from Slack
   */
  private async parseTaskCommand(
    commandText: string,
    webClient: WebClient,
    channelId: string,
    githubToken: string,
    slackUserId: string,
  ): Promise<{
    description: string;
    githubRepository: {
      owner: string;
      repo: string;
    };
  } | null> {
    const trimmedText = commandText.trim();
    const explicitRepoMatch = trimmedText.match(/^\[(.+?\/.+?)\]\s*(.*)$/);

    let ownerAndRepo: { owner: string; repo: string } | null = null;
    let description: string;

    if (explicitRepoMatch) {
      // User provided explicit repo format: [owner/repo] description
      const repository = explicitRepoMatch[1];
      description = explicitRepoMatch[2];
      ownerAndRepo = parseOwnerAndRepo(repository);

      if (!ownerAndRepo) {
        await webClient.chat.postEphemeral({
          channel: channelId,
          user: slackUserId,
          text: `💬 Input: \`${commandText}\`\n\n❌ Invalid repository format. Expected: owner/repo`,
        });
        return null;
      }
    } else {
      // No explicit repo provided, try to extract from channel topic
      description = trimmedText;
      ownerAndRepo = await this.extractRepoFromChannelTopic(
        webClient,
        channelId,
      );

      if (!ownerAndRepo) {
        await webClient.chat.postEphemeral({
          channel: channelId,
          user: slackUserId,
          text: `💬 Input: \`${commandText}\`\n\n❌ No repository specified. Either:\n• Use format: \`/newtask [owner/repo] description\`\n• Or set a channel topic with format: \`[repo:owner/repo]\`\n\nExample: \`/newtask [TabbyML/tabby] fix the login issue\`\nOr set topic: \`Project discussion [repo:TabbyML/tabby]\``,
        });
        return null;
      }
    }

    const { owner, repo } = ownerAndRepo;

    const repoValidation = await githubService.validateRepoAccess(
      githubToken,
      owner,
      repo,
    );

    if (!repoValidation) {
      await webClient.chat.postEphemeral({
        channel: channelId,
        user: slackUserId,
        text: `💬 Input: \`${commandText}\`\n\n❌ Failed to validate GitHub repo: ${owner}/${repo}. Please check if the repository exists and you have access to it.`,
      });
      return null;
    }

    return {
      description: description || "Work on repository",
      githubRepository: {
        owner,
        repo,
      },
    };
  }

  private extractSlackDataFromTask(task: Task) {
    return task.event?.data as {
      prompt: string;
      channel?: string;
      ts?: string;
      slackUserId?: string;
      githubRepository: {
        owner: string;
        repo: string;
      };
    };
  }

  /**
   * Extract header info from task data instead of Slack API
   */
  private extractHeaderInfoFromTask(task: Task): {
    prompt: string;
    githubRepository: { owner: string; repo: string };
    slackUserId: string;
  } {
    const eventData = this.extractSlackDataFromTask(task);
    return {
      prompt: eventData.prompt || "Work on repository",
      githubRepository: eventData.githubRepository,
      slackUserId: eventData.slackUserId || "FAKE_USER_ID",
    };
  }

  private extractCompletionResult(messages?: DBMessage[]): string | undefined {
    if (!messages) return undefined;

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "attemptCompletion" &&
            part.toolInvocation?.args?.result &&
            typeof part.toolInvocation.args.result === "string"
          ) {
            return part.toolInvocation.args.result;
          }
        }
      }
    }
    return undefined;
  }

  private extractErrorInformation(task: Task): {
    message: string;
    details: string;
  } {
    if (!task) throw new Error("Task is required");

    if (task.error?.kind && task.error?.message) {
      let details = `Error Type: ${task.error.kind}\nMessage: ${task.error.message}`;

      if (
        task.error.kind === "APICallError" &&
        "requestBodyValues" in task.error
      ) {
        details += `\nAPI Request Details: ${JSON.stringify(task.error.requestBodyValues, null, 2)}`;
      }

      return {
        message: task.error.message,
        details,
      };
    }

    const fallbackError = extractErrorInfo(task.conversation?.messages);
    return {
      message: fallbackError.message || "Task execution failed",
      details: fallbackError.details || "No specific error details available",
    };
  }

  private async sendTaskStarting({
    userId,
    prompt,
    event,
    slackUserId,
    githubRepository,
    taskId,
    todos,
  }: {
    userId: string;
    prompt: string;
    event: Extract<TaskCreateEvent, { type: "slack:new-task" }>;
    slackUserId: string;
    githubRepository: { owner: string; repo: string };
    taskId: string;
    todos?: Todo[];
  }): Promise<boolean> {
    const webClient = await slackService.getWebClientByUser(userId);
    if (!webClient || !event.data.channel || !event.data.ts) return false;

    // Update main message with starting status
    const blocks = slackRichTextRenderer.renderTaskStarting(
      prompt,
      githubRepository,
      slackUserId,
      taskId,
      todos,
      0,
      0,
      null,
    );

    await webClient.chat.update({
      channel: event.data.channel,
      ts: event.data.ts,
      text: "Task starting...",
      blocks,
    });

    return true;
  }

  /**
   * Extract waiting reason and follow-up suggestions from task
   */
  private extractAskFollowUpQuestion(
    task: Task,
  ): { question: string; followUp?: string[] } | undefined {
    // Check recent messages for askFollowupQuestion tool calls
    if (!task.conversation?.messages) {
      return;
    }

    for (let i = task.conversation.messages.length - 1; i >= 0; i--) {
      const message = task.conversation.messages[i];
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "askFollowupQuestion" &&
            part.toolInvocation?.args?.question
          ) {
            return {
              question: part.toolInvocation.args.question as string,
              followUp: part.toolInvocation.args.followUp as
                | string[]
                | undefined,
            };
          }
        }
      }
    }
  }

  private extractTaskStatistics(task: Task): {
    requestsCount: number;
    totalTokens: number;
  } {
    if (!task) {
      return { requestsCount: 0, totalTokens: 0 };
    }

    // Get message count from conversation
    const requestsCount =
      task.conversation?.messages?.reduce((count_, message) => {
        let count = count_;
        if (message.role === "assistant") {
          for (const part of message.parts || []) {
            if (part.type === "step-start") {
              count++;
            }
          }
        }
        return count;
      }, 0) || 0;

    // Get total tokens from task totalTokens field
    const totalTokens = task.totalTokens || 0;

    return { requestsCount, totalTokens };
  }

  shouldNotifyForEvent(eventType: TaskCreateEvent["type"] | null) {
    return shouldNotifyForEvent(eventType);
  }

  enqueueNotifyTaskSlack({
    userId,
    uid,
    eventType,
  }: {
    userId: string;
    uid: string;
    eventType: TaskCreateEvent["type"] | null;
  }) {
    if (!shouldNotifyForEvent(eventType)) return;
    enqueueNotifyTaskSlack({ userId, uid });
  }

  /**
   * Handle followup action from Slack button
   */
  async handleFollowupAction(params: {
    taskId: string;
    content: string;
    userId: string;
    channel?: string;
    messageTs?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Submit the answer using taskService
      await taskService.appendUserMessage(
        params.userId,
        params.taskId,
        params.content,
      );

      return { success: true };
    } catch (error) {
      logger.error("Failed to handle followup action", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Parse followup action payload
   */
  parseFollowupActionPayload(payload: string): {
    taskId: string;
    type: string;
    encodedContent?: string;
  } | null {
    const parts = payload.split("_");
    if (parts.length < 2) return null;

    return {
      taskId: parts[0],
      type: parts[1],
      encodedContent: parts.slice(2).join("_"), // Handle cases where content might contain underscores
    };
  }

  /**
   * Decode base64 content
   */
  decodeContent(encodedContent: string): string | null {
    try {
      return Buffer.from(encodedContent, "base64").toString("utf-8");
    } catch (error) {
      logger.error("Failed to decode content", error);
      return null;
    }
  }
}

export const slackTaskService = new SlackTaskService();

// Utility functions
function isNotifyableTask(task: Task): boolean {
  return shouldNotifyForEvent(task?.event?.type || null);
}

function shouldNotifyForEvent(eventType: TaskCreateEvent["type"] | null) {
  return eventType === "slack:new-task";
}

function extractErrorInfo(messages?: DBMessage[]): {
  message?: string;
  details?: string;
} {
  if (!messages) return {};

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    if (message.role === "assistant" && message.parts) {
      for (const part of message.parts) {
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation.state === "result" &&
          part.toolInvocation.result &&
          typeof part.toolInvocation.result === "object" &&
          "error" in part.toolInvocation.result
        ) {
          const error = part.toolInvocation.result.error;
          return {
            message: `Tool ${part.toolInvocation.toolName} failed`,
            details: typeof error === "string" ? error : JSON.stringify(error),
          };
        }
      }
    }

    if (message.parts) {
      for (const part of message.parts) {
        if (
          part.type === "text" &&
          part.text &&
          part.text.toLowerCase().includes("error")
        ) {
          return {
            message: "Task execution failed",
            details: part.text.substring(0, 500),
          };
        }
      }
    }
  }

  return {
    message: "Task failed",
    details: "No specific error details available",
  };
}
