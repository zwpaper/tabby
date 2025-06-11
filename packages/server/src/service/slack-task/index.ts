import type { DBMessage, UserEvent } from "@ragdoll/db";
import type { AnyBlock } from "@slack/web-api";

import { parseOwnerAndRepo } from "@ragdoll/common/git-utils";
import { githubService } from "../github";
import { minionService } from "../minion";
import { slackService } from "../slack";
import { taskService } from "../task";
import { slackRichTextRenderer } from "./slack-rich-text";

// Type alias for validated Slack task
type Task = Awaited<ReturnType<(typeof taskService)["get"]>>;

// Interface for extracted task data used in notifications
interface TaskNotificationData {
  userQuery: string;
  startedAt: string;
  elapsed: string;
  completedTools?: string[];
}

class SlackTaskService {
  async notifyTaskStatusUpdate(userId: string, taskId: number) {
    const task = await taskService.get(taskId, userId);
    if (!task || !isSlackTask(task)) {
      return;
    }

    switch (task.status) {
      case "completed":
        await this.notifyTaskCompletion(userId, taskId, task);
        break;
      case "failed":
        await this.notifyTaskFailure(userId, taskId, task);
        break;
      case "pending-tool":
        await this.notifyTaskPendingTool(userId, taskId, task);
        break;
      case "pending-input":
        await this.notifyTaskPendingInput(userId, taskId, task);
        break;
      default:
        break;
    }
  }

  private async notifyTaskPendingInput(
    userId: string,
    taskId: number,
    task: Task,
  ) {
    if (!task) return;

    const taskData = extractTaskNotificationData(task);

    const richTextBlocks = slackRichTextRenderer.renderTaskPendingInput(
      taskId,
      taskData,
    );

    await this.updateSlackMessage(userId, task, richTextBlocks);
  }

  private async notifyTaskPendingTool(
    userId: string,
    taskId: number,
    task: Task,
  ) {
    if (!task) return;

    const pendingToolInfo = this.extractPendingToolInfo(
      task.conversation?.messages,
    );
    const taskData = extractTaskNotificationData(task);

    const richTextBlocks = slackRichTextRenderer.renderTaskPendingTool(
      taskId,
      pendingToolInfo.toolName,
      pendingToolInfo.description,
      taskData,
    );

    await this.updateSlackMessage(userId, task, richTextBlocks);
  }

  private async notifyTaskFailure(userId: string, taskId: number, task: Task) {
    if (!task) return;

    const errorInfo = this.extractErrorInformation(task);
    const taskData = this.extractCompleteTaskNotificationData(task);

    const richTextBlocks = slackRichTextRenderer.renderTaskFailure(
      taskId,
      errorInfo.message,
      errorInfo.details,
      taskData,
    );

    await this.updateSlackMessage(userId, task, richTextBlocks);
  }

  private async notifyTaskCompletion(
    userId: string,
    taskId: number,
    task: Task,
  ) {
    if (!task) return;

    const taskData = this.extractCompleteTaskNotificationData(task);
    const completionResult = this.extractCompletionResult(
      task.conversation?.messages,
    );

    const richTextBlocks = slackRichTextRenderer.renderTaskCompletion(
      taskId,
      completionResult || "Task completed successfully.",
      taskData,
    );

    await this.updateSlackMessage(userId, task, richTextBlocks);

    await this.addCompletionReaction(userId, task);
  }

  private async addCompletionReaction(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackEventData(task);
    const integration = await slackService.getIntegration(userId);

    if (!integration || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    await integration.webClient.reactions.add({
      channel: slackEventData.channel,
      timestamp: slackEventData.ts,
      name: "white_check_mark",
    });
  }

  /**
   * Create a GitHub repository task with cloud runner (E2B)
   */
  async createTaskWithCloudRunner(
    userId: string,
    command: { channel_id: string; user_id: string; text?: string },
    taskText: string,
  ) {
    const integration = await slackService.getIntegration(userId);
    if (!integration) return;

    const githubToken = await githubService.getAccessToken(userId);
    if (!githubToken) {
      return;
    }

    const parsedCommand = await this.parseTaskCommand(
      taskText,
      integration,
      command.channel_id,
      githubToken,
    );

    if (!parsedCommand) {
      return;
    }

    const taskPrompt = parsedCommand.description;

    const initialMessage = `🚀 Creating GitHub task for ${parsedCommand.githubRepository.owner}/${parsedCommand.githubRepository.repo}: ${parsedCommand.description}\n☁️ Starting cloud runner...`;
    const messageResult = await integration.webClient.chat.postMessage({
      channel: command.channel_id,
      text: initialMessage,
    });

    if (!messageResult.ok || !messageResult.ts) {
      console.error("Failed to post GitHub task message:", messageResult.error);
      return;
    }

    const slackEvent: Extract<UserEvent, { type: "slack:new-task" }> = {
      type: "slack:new-task",
      data: {
        channel: command.channel_id,
        ts: messageResult.ts,
        prompt: taskPrompt,
      },
    };

    const taskId = await taskService.createWithUserMessage(
      userId,
      taskPrompt,
      slackEvent,
    );

    const minion = await minionService.create({
      userId,
      taskId,
      githubRepository: parsedCommand.githubRepository,
      githubAccessToken: githubToken,
    });

    const taskData = this.createTaskCreationData(taskPrompt);
    const richTextBlocks = slackRichTextRenderer.renderTaskCreationResponse(
      taskId,
      `${taskPrompt}\n\n☁️ Cloud runner started in background`,
      taskData,
    );

    await this.reply(
      userId,
      command.channel_id,
      messageResult.ts,
      richTextBlocks,
    );

    const successBlocks = slackRichTextRenderer.renderCloudRunnerSuccess(
      minion.url,
    );
    await integration.webClient.chat.postMessage({
      channel: command.channel_id,
      thread_ts: messageResult.ts,
      blocks: successBlocks,
      text: "✅ Cloud runner started successfully!",
    });

    return taskId;
  }

  /**
   * Parse GitHub repository task command from Slack
   */
  private async parseTaskCommand(
    commandText: string,
    integration: Awaited<ReturnType<typeof slackService.getIntegration>>,
    channelId: string,
    githubToken: string,
  ): Promise<{
    description: string;
    githubRepository: {
      owner: string;
      repo: string;
    };
  } | null> {
    const trimmedText = commandText.trim();
    const match = trimmedText.match(/^\[(.+?\/.+?)\]\s*(.*)$/);

    if (!match) {
      await integration?.webClient.chat.postMessage({
        channel: channelId,
        text: "❌ Invalid command format. Expected: [owner/repo] description",
      });
      return null;
    }

    const repository = match[1];
    const description = match[2];
    const ownerAndRepo = parseOwnerAndRepo(repository);

    if (!ownerAndRepo) {
      await integration?.webClient.chat.postMessage({
        channel: channelId,
        text: "❌ Invalid repository format. Expected: owner/repo",
      });
      return null;
    }
    const { owner, repo } = ownerAndRepo;

    const repoValidation = await githubService.validateRepoAccess(
      githubToken,
      owner,
      repo,
    );

    if (!repoValidation) {
      await integration?.webClient.chat.postMessage({
        channel: channelId,
        text: "❌ Failed to validate GitHub repo",
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

  private async reply(
    userId: string,
    channel: string,
    ts: string,
    text: AnyBlock[] | string,
  ) {
    const integration = await slackService.getIntegration(userId);
    if (!integration) return;

    switch (typeof text) {
      case "string":
        return await integration.webClient.chat.postMessage({
          channel,
          thread_ts: ts,
          text,
        });
      case "object":
        return await integration.webClient.chat.postMessage({
          channel,
          thread_ts: ts,
          blocks: text,
          text: this.extractFallbackText(text),
        });
      default:
        console.error("Invalid text type, skipping reply");
        return undefined;
    }
  }

  private async updateSlackMessage(
    userId: string,
    task: Task,
    blocks: AnyBlock[],
  ) {
    if (!task) {
      console.error("Task not found");
      return;
    }

    const slackEventData = this.extractSlackEventData(task);

    if (!slackEventData?.ts || !slackEventData?.channel) {
      console.error(`No message data found for task ${task.id}`);
      return;
    }

    const integration = await slackService.getIntegration(userId);
    if (!integration) {
      console.error("No Slack integration found for user");
      return;
    }

    const botMessageTs = await this.findBotMessageInThread(
      integration,
      slackEventData.channel,
      slackEventData.ts,
    );

    if (!botMessageTs) {
      console.error(`No bot message found in thread for task ${task.id}`);
      return;
    }

    await integration.webClient.chat.update({
      channel: slackEventData.channel,
      ts: botMessageTs,
      blocks,
      text: this.extractFallbackText(blocks),
    });
  }

  private extractFallbackText(blocks: AnyBlock[]): string {
    for (const block of blocks) {
      if (
        block.type === "section" &&
        "text" in block &&
        block.text?.type === "mrkdwn"
      ) {
        const text = block.text.text
          .replace(/\*([^*]+)\*/g, "$1")
          .replace(/_([^_]+)_/g, "$1")
          .replace(/`([^`]+)`/g, "$1")
          .replace(/```[^`]*```/g, "[Code Block]")
          .replace(/> (.+)/g, "$1")
          .replace(/\n/g, " ")
          .trim();

        if (text) {
          return text.length > 150 ? `${text.substring(0, 147)}...` : text;
        }
      }
    }
    return "AI Agent Task Update";
  }

  private async findBotMessageInThread(
    integration: Awaited<ReturnType<typeof slackService.getIntegration>>,
    channel: string,
    threadTs: string,
  ): Promise<string | null> {
    if (!integration) return null;

    const result = await integration.webClient.conversations.replies({
      channel,
      ts: threadTs,
      inclusive: true,
    });

    if (!result.ok || !result.messages) {
      console.error("Failed to fetch thread replies:", result.error);
      return null;
    }

    const authResult = await integration.webClient.auth.test();
    if (!authResult.ok) {
      console.error("Failed to authenticate bot:", authResult.error);
      return null;
    }

    const botUserId = authResult.user_id;
    const botId = authResult.bot_id;

    for (const message of result.messages) {
      if (message.ts === threadTs) continue;
      if (message.user === botUserId || message.bot_id === botId) {
        return message.ts || null;
      }
    }

    return null;
  }

  private extractCompleteTaskNotificationData(
    task: Task,
  ): TaskNotificationData {
    if (!task) throw new Error("Task is required");

    const slackEvent = this.extractSlackEventData(task);
    const userQuery = extractUserQuery(slackEvent.prompt);

    return {
      userQuery,
      startedAt: task.createdAt?.toLocaleString() || "Unknown",
      elapsed: calculateElapsed(task.createdAt),
      completedTools: extractCompletedTools(task.conversation?.messages),
    };
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

  private extractSlackEventData(task: Task) {
    if (!task || !isSlackTask(task)) {
      throw new Error("Invalid Slack task");
    }

    const slackEvent = task.event as Extract<
      UserEvent,
      { type: "slack:new-task" }
    >;
    return slackEvent.data;
  }

  private createTaskCreationData(messageText: string): {
    userQuery: string;
    startedAt: string;
  } {
    const userQuery = extractUserQuery(messageText);
    const startedAt = new Date().toLocaleString();

    return {
      userQuery,
      startedAt,
    };
  }

  private extractPendingToolInfo(messages?: DBMessage[]): {
    toolName?: string;
    description?: string;
  } {
    if (!messages) return {};

    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.state !== "result"
          ) {
            const toolName = part.toolInvocation?.toolName || "unknown tool";
            const description = getToolDescription(
              toolName,
              part.toolInvocation?.args,
            );
            return { toolName, description };
          }
        }
      }
    }
    return {};
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
}

export const slackTaskService = new SlackTaskService();

// Utility functions
function extractTaskNotificationData(task: Task): TaskNotificationData {
  if (!task) throw new Error("Task is required");

  const slackEvent = task.event as Extract<
    UserEvent,
    { type: "slack:new-task" }
  >;
  const messageData = slackEvent.data;
  const userQuery = extractUserQuery(messageData.prompt);

  return {
    userQuery,
    startedAt: task.createdAt?.toLocaleString() || "Unknown",
    elapsed: calculateElapsed(task.createdAt),
  };
}

function isSlackTask(task: Task): boolean {
  return task?.event?.type === "slack:new-task";
}

function extractUserQuery(messageText?: string): string {
  if (!messageText) return "Task execution requested";
  const cleanText = messageText.replace(/<@[A-Z0-9]+>/g, "").trim();
  return cleanText || "Task execution requested";
}

function calculateElapsed(createdAt?: Date): string {
  if (!createdAt) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m elapsed`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m elapsed`;
  }
  return "Just started";
}

function extractCompletedTools(messages?: DBMessage[]): string[] {
  if (!messages) return [];

  const completedTools: string[] = [];

  for (const message of messages) {
    if (message.role === "assistant" && message.parts) {
      for (const part of message.parts) {
        if (
          part.type === "tool-invocation" &&
          part.toolInvocation?.state === "result" &&
          part.toolInvocation.toolName
        ) {
          const toolName = part.toolInvocation.toolName;
          if (!completedTools.includes(toolName)) {
            completedTools.push(toolName);
          }
        }
      }
    }
  }

  return completedTools;
}

function getToolDescription(
  toolName: string,
  args?: Record<string, unknown>,
): string {
  const descriptions: Record<string, string> = {
    readFile: "Reading file contents",
    writeToFile: "Writing to file",
    executeCommand: "Executing command",
    searchFiles: "Searching through files",
    applyDiff: "Applying code changes",
    askFollowupQuestion: "Asking for user input",
    webFetch: "Fetching web content",
    listFiles: "Listing directory contents",
  };

  const baseDescription = descriptions[toolName] || `Using ${toolName} tool`;

  if (args) {
    if (toolName === "readFile" && typeof args.path === "string") {
      return `${baseDescription}: ${args.path}`;
    }
    if (toolName === "executeCommand" && typeof args.command === "string") {
      return `${baseDescription}: ${args.command}`;
    }
    if (toolName === "writeToFile" && typeof args.path === "string") {
      return `${baseDescription}: ${args.path}`;
    }
  }

  return baseDescription;
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
