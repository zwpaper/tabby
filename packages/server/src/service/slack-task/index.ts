import type { DBMessage, Todo, UserEvent } from "@ragdoll/db";
import type { WebClient } from "@slack/web-api";

import {
  parseGitOriginUrl,
  parseOwnerAndRepo,
} from "@ragdoll/common/git-utils";
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

    // Get header info from task data instead of Slack API
    const headerInfo = this.extractHeaderInfoFromTask(task);

    const waitingReason = this.extractWaitingReason(task);
    if (!waitingReason) {
      // If there's no waiting reason, we don't need to send a message
      return;
    }

    const blocks = slackRichTextRenderer.renderTaskAskFollowUpQuestion(
      headerInfo.prompt,
      headerInfo.githubRepository,
      headerInfo.slackUserId,
      task.uid,
      waitingReason,
      task.todos,
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

    // Get header info from task data instead of Slack API
    const headerInfo = this.extractHeaderInfoFromTask(task);

    const pendingToolInfo = this.extractPendingToolInfo(
      task.conversation?.messages,
    );
    const completedTools = this.extractCompletedTools(
      task.conversation?.messages,
    );
    const blocks = slackRichTextRenderer.renderTaskPendingTool(
      headerInfo.prompt,
      headerInfo.githubRepository,
      headerInfo.slackUserId,
      task.uid,
      task.todos,
      completedTools,
      pendingToolInfo.toolName,
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

    // Get header info from task data instead of Slack API
    const headerInfo = this.extractHeaderInfoFromTask(task);

    const errorInfo = this.extractErrorInformation(task);
    const completedTools = this.extractCompletedTools(
      task.conversation?.messages,
    );
    const failedTool = this.extractFailedTool(task.conversation?.messages);

    const blocks = slackRichTextRenderer.renderTaskFailed(
      headerInfo.prompt,
      headerInfo.githubRepository,
      headerInfo.slackUserId,
      task.uid,
      errorInfo.message,
      task.todos,
      completedTools,
      failedTool,
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

    // Get header info from task data instead of Slack API
    const headerInfo = this.extractHeaderInfoFromTask(task);

    const completionResult = this.extractCompletionResult(
      task.conversation?.messages,
    );

    const blocks = slackRichTextRenderer.renderTaskComplete(
      headerInfo.prompt,
      headerInfo.githubRepository,
      headerInfo.slackUserId,
      task.uid,
      completionResult || "Task completed successfully.",
      task.todos,
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
      slackUserId,
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
      slackUserId,
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
        slackUserId: slackUserId,
      },
    };

    const { uid } = await taskService.createWithRunner({
      userId,
      prompt: taskPrompt,
      githubRepository: parsedCommand.githubRepository,
      event: slackEvent,
    });

    // Get the created task to retrieve todos
    const task = await taskService.get(uid, userId);

    await this.sendTaskStarting({
      userId,
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
      console.error("Error extracting repo from channel topic:", error);
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
          text: "❌ Invalid repository format. Expected: owner/repo",
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
          text: "❌ No repository specified. Either:\n• Use format: `/newtask [owner/repo] description`\n• Or set a channel topic with format: `[repo:owner/repo]`\n\nExample: `/newtask [TabbyML/tabby] fix the login issue`\nOr set topic: `Project discussion [repo:TabbyML/tabby]`",
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
        text: `❌ Failed to validate GitHub repo: ${owner}/${repo}. Please check if the repository exists and you have access to it.`,
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
      slackUserId?: string;
    };
  }

  /**
   * Extract header info from task data instead of Slack API
   */
  private extractHeaderInfoFromTask(task: Task | null): {
    prompt: string;
    githubRepository: { owner: string; repo: string };
    slackUserId: string;
  } {
    if (!task) {
      return {
        prompt: "Work on repository",
        githubRepository: { owner: "user", repo: "repo" },
        slackUserId: "FAKE_USER_ID",
      };
    }

    let prompt = "Work on repository";

    const eventData = this.extractSlackDataFromTask(task);
    if (eventData.prompt) {
      prompt = eventData.prompt;
    }

    // Get repository from task.git.origin using parseGitOriginUrl
    let githubRepository = { owner: "user", repo: "repo" };
    if (task.git) {
      const gitInfo = parseGitOriginUrl(task.git.origin);
      if (gitInfo) {
        githubRepository = { owner: gitInfo.owner, repo: gitInfo.repo };
      }
    }

    // Get slackUserId from event data or fallback to fake ID
    const slackUserId = eventData.slackUserId || "FAKE_USER_ID";

    return {
      prompt,
      githubRepository,
      slackUserId,
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
    event,
    slackUserId,
    githubRepository,
    taskId,
    todos,
  }: {
    userId: string;
    prompt: string;
    event: Extract<UserEvent, { type: "slack:new-task" }>;
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
   * Extract waiting reason from task
   */
  private extractWaitingReason(task: Task): string | undefined {
    // Check recent messages for askFollowupQuestion tool calls
    if (!task?.conversation?.messages) {
      return;
    }

    for (let i = task.conversation.messages.length - 1; i >= 0; i--) {
      const message = task.conversation.messages[i];
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.toolName === "ask-followup-question" &&
            part.toolInvocation?.args?.question
          ) {
            return part.toolInvocation.args.question as string;
          }
        }
      }
    }
  }

  /**
   * Extract completed tools from messages
   */
  private extractCompletedTools(messages?: DBMessage[]): string[] {
    const completedTools: string[] = [];

    if (!messages) return completedTools;

    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.state === "result" &&
            part.toolInvocation?.toolName
          ) {
            const toolName = part.toolInvocation.toolName;
            completedTools.push(toolName);
          }
        }
      }
    }

    return completedTools;
  }

  /**
   * Extract failed tool from messages
   */
  private extractFailedTool(messages?: DBMessage[]): string | undefined {
    if (!messages) return undefined;

    // Search from the latest messages first
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            part.toolInvocation?.state === "result" &&
            part.toolInvocation?.toolName &&
            part.toolInvocation?.result &&
            typeof part.toolInvocation.result === "object" &&
            "error" in part.toolInvocation.result
          ) {
            return part.toolInvocation.toolName;
          }
        }
      }
    }

    return undefined;
  }
}

export const slackTaskService = new SlackTaskService();

// Utility functions
function isNotifyableTask(task: Task): boolean {
  return task?.event?.type === "slack:new-task";
}

function getToolDescription(
  toolName: string,
  args?: Record<string, unknown>,
): string {
  if (args) {
    if (toolName === "readFile" && typeof args.path === "string") {
      return `I'm reading ${args.path} to understand its contents`;
    }
    if (toolName === "listFiles" && typeof args.path === "string") {
      return `I'm exploring the directory ${args.path} to see what files are available`;
    }
    if (toolName === "executeCommand" && typeof args.command === "string") {
      return `I'm running the command: ${args.command}`;
    }
    if (toolName === "searchFiles" && typeof args.query === "string") {
      return `I'm searching through files for "${args.query}"`;
    }
    if (toolName === "globFiles" && typeof args.pattern === "string") {
      return `I'm finding files that match the pattern ${args.pattern}`;
    }
    if (toolName === "writeToFile" && typeof args.path === "string") {
      return `I'm writing content to ${args.path}`;
    }
    if (toolName === "applyDiff" && typeof args.file === "string") {
      return `I'm applying code changes to ${args.file}`;
    }
    if (toolName === "webFetch" && typeof args.url === "string") {
      return `I'm fetching content from ${args.url}`;
    }
  }

  return `I'm using the ${toolName} tool to help me with the task`;
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
