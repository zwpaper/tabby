import type { DBMessage, UserEvent } from "@ragdoll/db";
import type { WebClient } from "@slack/web-api";

import { parseOwnerAndRepo } from "@ragdoll/common/git-utils";
import { enqueueNotifyTaskSlack } from "../background-job";
import { githubService } from "../github";
import { slackService } from "../slack";
import { taskService } from "../task";
import { slackRichTextRenderer } from "./slack-rich-text";

type Task = Awaited<ReturnType<(typeof taskService)["get"]>>;

class SlackTaskService {
  async notifyTaskStatusUpdate(userId: string, uid: string, async = true) {
    if (async) {
      enqueueNotifyTaskSlack({ userId, uid });
      return;
    }

    const task = await taskService.get(uid, userId);
    if (!task || !isNotifyableTask(task)) {
      return;
    }

    switch (task.status) {
      case "completed":
        await this.sendTaskCompletion(userId, task);
        break;
      case "failed":
        await this.sendTaskFailure(userId, task);
        break;
      case "pending-tool":
        await this.sendTaskPendingTool(userId, task);
        break;
      case "pending-input":
        await this.sendTaskPendingInput(userId, task);
        break;
      default:
        break;
    }
  }

  private async sendTaskPendingInput(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    const elapsed = calculateElapsed(task.createdAt);
    const blocks = slackRichTextRenderer.renderTaskWaitingInput(
      slackEventData.prompt,
      elapsed,
    );

    await webClient.chat.update({
      channel: slackEventData.channel,
      ts: slackEventData.ts,
      text: "Task waiting for input",
      blocks,
    });
  }

  private async sendTaskPendingTool(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    const pendingToolInfo = this.extractPendingToolInfo(
      task.conversation?.messages,
    );
    const elapsed = calculateElapsed(task.createdAt);
    const toolDescription = pendingToolInfo.description || "Processing task";

    const blocks = slackRichTextRenderer.renderTaskRunning(
      slackEventData.prompt,
      toolDescription,
      elapsed,
    );

    await webClient.chat.update({
      channel: slackEventData.channel,
      ts: slackEventData.ts,
      text: "Task running",
      blocks,
    });
  }

  private async sendTaskFailure(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    const errorInfo = this.extractErrorInformation(task);
    const elapsed = calculateElapsed(task.createdAt);

    const blocks = slackRichTextRenderer.renderTaskFailed(
      slackEventData.prompt,
      elapsed,
      errorInfo.message,
    );

    await webClient.chat.update({
      channel: slackEventData.channel,
      ts: slackEventData.ts,
      text: "Task failed",
      blocks,
    });
  }

  private async sendTaskCompletion(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    const completionResult = this.extractCompletionResult(
      task.conversation?.messages,
    );
    const elapsed = calculateElapsed(task.createdAt);

    const blocks = slackRichTextRenderer.renderTaskComplete(
      slackEventData.prompt,
      elapsed,
      completionResult || "Task completed successfully.",
    );

    await webClient.chat.update({
      channel: slackEventData.channel,
      ts: slackEventData.ts,
      text: "Task completed",
      blocks,
    });

    await this.addCompletionReaction(userId, task);
  }

  private async addCompletionReaction(userId: string, task: Task) {
    if (!task) return;

    const slackEventData = this.extractSlackDataFromTask(task);
    const webClient = await slackService.getWebClientByUser(userId);

    if (!webClient || !slackEventData.channel || !slackEventData.ts) {
      return;
    }

    await webClient.reactions.add({
      channel: slackEventData.channel,
      timestamp: slackEventData.ts,
      name: "white_check_mark",
    });
  }

  /**
   * Send created task message to slack and return message timestamp
   */
  private async sendCreatedTaskMessage(
    userId: string,
    prompt: string,
    githubRepository: { owner: string; repo: string },
    channelId: string,
  ): Promise<{ ts: string } | null> {
    const webClient = await slackService.getWebClientByUser(userId);
    if (!webClient) return null;

    const blocks = slackRichTextRenderer.renderTaskCreated(
      prompt,
      githubRepository,
    );

    const messageResult = await webClient.chat.postMessage({
      channel: channelId,
      text: "Task created",
      blocks,
    });

    if (!messageResult.ok || !messageResult.ts) {
      console.error("Failed to post GitHub task message:", messageResult.error);
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
    userId: string,
    command: { channel_id: string; user_id: string; text?: string },
    taskText: string,
    slackUserId: string,
  ) {
    const webClient = await slackService.getWebClientByUser(userId);
    if (!webClient) return;

    const githubToken = await githubService.getAccessToken(userId);
    if (!githubToken) {
      return;
    }

    const parsedCommand = await this.parseTaskCommand(
      taskText,
      webClient,
      command.channel_id,
      githubToken,
    );

    if (!parsedCommand) {
      return;
    }

    const taskPrompt = parsedCommand.description;

    const slackInfo = await this.sendCreatedTaskMessage(
      userId,
      taskPrompt,
      parsedCommand.githubRepository,
      command.channel_id,
    );

    if (!slackInfo?.ts) {
      console.error("Failed to send slack message");
      return;
    }

    const slackEvent: Extract<UserEvent, { type: "slack:new-task" }> = {
      type: "slack:new-task",
      data: {
        channel: command.channel_id,
        ts: slackInfo.ts,
        prompt: taskPrompt,
      },
    };

    const { uid, minion } = await taskService.createWithRunner({
      userId,
      prompt: taskPrompt,
      githubRepository: parsedCommand.githubRepository,
      event: slackEvent,
    });

    await this.sendTaskStarting({
      userId,
      prompt: taskPrompt,
      serverUrl: minion.url,
      event: slackEvent,
      slackUserId,
    });

    return uid;
  }

  /**
   * Parse GitHub repository task command from Slack
   */
  private async parseTaskCommand(
    commandText: string,
    webClient: WebClient,
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
      await webClient.chat.postMessage({
        channel: channelId,
        text: "❌ Invalid command format. Expected: [owner/repo] description",
      });
      return null;
    }

    const repository = match[1];
    const description = match[2];
    const ownerAndRepo = parseOwnerAndRepo(repository);

    if (!ownerAndRepo) {
      await webClient.chat.postMessage({
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
      await webClient.chat.postMessage({
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

  private extractSlackDataFromTask(task: Task) {
    if (!task || !isNotifyableTask(task)) {
      throw new Error("Invalid Slack task");
    }

    return task.event?.data as {
      prompt: string;
      channel?: string;
      ts?: string;
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
    serverUrl,
    event,
    slackUserId,
  }: {
    userId: string;
    prompt: string;
    serverUrl: string;
    event: Extract<UserEvent, { type: "slack:new-task" }>;
    slackUserId: string;
  }): Promise<boolean> {
    const webClient = await slackService.getWebClientByUser(userId);
    if (!webClient || !event.data.channel || !event.data.ts) return false;

    // Update main message with starting status
    const blocks = slackRichTextRenderer.renderTaskStarting(prompt);

    await webClient.chat.update({
      channel: event.data.channel,
      ts: event.data.ts,
      text: "Task starting...",
      blocks,
    });

    // Send ephemeral cloud runner success message
    const ephemeralBlocks =
      slackRichTextRenderer.renderCloudRunnerSuccess(serverUrl);

    await webClient.chat.postEphemeral({
      channel: event.data.channel,
      user: slackUserId,
      text: "Cloud runner started successfully!",
      blocks: ephemeralBlocks,
    });

    return true;
  }
}

export const slackTaskService = new SlackTaskService();

// Utility functions
function isNotifyableTask(task: Task): boolean {
  return task?.event?.type === "slack:new-task";
}

function calculateElapsed(createdAt?: Date): string {
  if (!createdAt) return "Recently";

  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);

  if (diffHours > 0) {
    return `${diffHours}h ${diffMinutes % 60}m`;
  }
  if (diffMinutes > 0) {
    return `${diffMinutes}m`;
  }
  return "Just started";
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
      return `Reading ${args.path}`;
    }
    if (toolName === "executeCommand" && typeof args.command === "string") {
      return `Running ${args.command}`;
    }
    if (toolName === "writeToFile" && typeof args.path === "string") {
      return `Writing ${args.path}`;
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
