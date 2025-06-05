import type { DBMessage, UserEvent } from "@ragdoll/common";
import type { AnyBlock } from "@slack/web-api";
import { slackService } from "../slack";
import { taskService } from "../task";
import { slackRichTextRenderer } from "./slack-rich-text";

// Generic type for Slack messages that covers both GenericMessageEvent and AppMentionEvent

// Type alias for validated Slack task
type Task = Awaited<ReturnType<typeof getValidatedSlackTask>>;

// Interface for extracted task data used in notifications
interface TaskNotificationData {
  userQuery: string;
  startedAt: string;
  elapsed: string;
  completedTools?: string[];
}

class SlackTaskService {
  async notifyTaskStatusUpdate(userId: string, taskId: number) {
    const task = await getValidatedSlackTask(userId, taskId);
    if (!task) return;

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

  async createTaskFromSlashCommand(
    userId: string,
    command: { channel_id: string; user_id: string; text?: string },
    taskText: string,
  ) {
    const integration = await slackService.getIntegration(userId);
    if (!integration) return;

    const messageResult = await integration.webClient.chat.postMessage({
      channel: command.channel_id,
      text: `Successfully created New task with prompt: ${taskText}`,
    });

    if (!messageResult.ok || !messageResult.ts) {
      console.error("Failed to post command message:", messageResult.error);
      return;
    }

    const slackEvent: Extract<UserEvent, { type: "slack:new-task" }> = {
      type: "slack:new-task",
      data: {
        ts: messageResult.ts,
        channel: command.channel_id,
        prompt: taskText,
      },
    };

    const taskId = await taskService.createWithUserMessage(
      userId,
      taskText,
      slackEvent,
    );

    const taskData = this.createTaskCreationData(taskText);
    const richTextBlocks = slackRichTextRenderer.renderTaskCreationResponse(
      taskId,
      taskText,
      taskData,
    );

    await this.reply(
      userId,
      command.channel_id,
      messageResult.ts,
      richTextBlocks,
    );

    return taskId;
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
        // Extract plain text from markdown, removing formatting
        const text = block.text.text
          .replace(/\*([^*]+)\*/g, "$1") // Remove bold
          .replace(/_([^_]+)_/g, "$1") // Remove italic
          .replace(/`([^`]+)`/g, "$1") // Remove code
          .replace(/```[^`]*```/g, "[Code Block]") // Replace code blocks
          .replace(/> (.+)/g, "$1") // Remove quotes
          .replace(/\n/g, " ") // Replace newlines with spaces
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

    // Use actual stored error information, with fallback to conversation extraction
    if (task.error?.kind && task.error?.message) {
      // Use stored error information
      let details = `Error Type: ${task.error.kind}\nMessage: ${task.error.message}`;

      // Add additional details for specific error types
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

    // Fallback to extracting error info from conversation messages
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

    // Find the last assistant message with attemptCompletion tool
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

// Utility functions for Slack task operations

// Get and validate a Slack task
async function getValidatedSlackTask(userId: string, taskId: number) {
  const task = await taskService.get(taskId, userId);
  if (!task || !isSlackTask(task)) {
    console.error(`Task ${taskId} is not a valid Slack task`);
    return null;
  }
  return task;
}

// Extract task notification data
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

// Check if task is from Slack
function isSlackTask(task: Task): boolean {
  return task?.event?.type === "slack:new-task";
}

// Helper functions
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

  // Add specific details based on args
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

// Helper function to extract error information from conversation messages
// This is now used as a fallback when stored error information is not available
function extractErrorInfo(messages?: DBMessage[]): {
  message?: string;
  details?: string;
} {
  if (!messages) return {};

  // Look for error messages in the conversation
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];

    // Check for tool invocation errors
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

    // Check for text content that might contain error information
    if (message.parts) {
      for (const part of message.parts) {
        if (
          part.type === "text" &&
          part.text &&
          part.text.toLowerCase().includes("error")
        ) {
          return {
            message: "Task execution failed",
            details: part.text.substring(0, 500), // Limit length
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
