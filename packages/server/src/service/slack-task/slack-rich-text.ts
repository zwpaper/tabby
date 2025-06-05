import type { AnyBlock } from "@slack/web-api";

interface TaskDisplayData {
  userQuery?: string;
  currentTool?: string;
  toolsCompleted?: number;
  startedAt?: string;
  elapsed?: string;
  currentOperation?: string;
  completedTools?: string[];
  status?: string;
  statusEmoji?: string;
  result?: string;
  errorMessage?: string;
  errorDetails?: string;
}

class SlackRichTextRenderer {
  private renderTaskBlocks(
    taskId: number,
    data: TaskDisplayData,
    statusFields: Array<{ type: "mrkdwn"; text: string }>,
    includeActions = true,
  ): AnyBlock[] {
    const userQuery = data.userQuery || "Task execution in progress";

    const blocks: AnyBlock[] = [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🐱 *AI Agent Task ${taskId} ${data.status || "Running"}*`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*💬 User Query:*\n> "${userQuery}"`,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        fields: statusFields,
      },
    ];

    if (data.currentOperation) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🔍 Current Operation:*\n${data.currentOperation}`,
        },
      });
    }

    if (data.result) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*✅ Task Result:*\n${data.result}`,
        },
      });
    }

    if (data.errorDetails) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Error Details:*\n\`\`\`${data.errorDetails.substring(0, 300)}\`\`\``,
        },
      });
    }

    if (data.completedTools && data.completedTools.length > 0) {
      const completedToolsText = data.completedTools.join(" ✅ | ");
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `⚡ Completed: ${completedToolsText} ✅`,
          },
        ],
      });
    }

    if (includeActions) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              emoji: true,
              text: "Open In VSCode",
            },
            url: `vscode://TabbyML.pochi/?task=${taskId}`,
            style: "primary",
            value: "view_agent_details",
          },
        ],
      });
    }

    return blocks;
  }

  renderTaskCreationResponse(
    taskId: number,
    description: string,
    data?: TaskDisplayData,
  ): AnyBlock[] {
    const taskData = {
      userQuery: description,
      status: "Created",
      startedAt: data?.startedAt || new Date().toLocaleString(),
      ...data,
    };

    const statusFields = [
      {
        type: "mrkdwn" as const,
        text: "*Current Status:*\n🟢 Initialized",
      },
      {
        type: "mrkdwn" as const,
        text: "*Progress:*\n0 steps completed",
      },
      {
        type: "mrkdwn" as const,
        text: "*Agent State:*\n🤖 Ready to start",
      },
      {
        type: "mrkdwn" as const,
        text: `*Started:*\n${taskData.startedAt}`,
      },
      {
        type: "mrkdwn" as const,
        text: "*Tokens Used:*\n0",
      },
    ];

    return this.renderTaskBlocks(taskId, taskData, statusFields);
  }

  renderTaskCompletion(
    taskId: number,
    result: string,
    data?: TaskDisplayData,
  ): AnyBlock[] {
    const taskData = {
      result,
      status: "Completed",
      userQuery: data?.userQuery || "Task completed successfully",
      startedAt: data?.startedAt || "Recently",
      elapsed: data?.elapsed || "Processing complete",
      completedTools: data?.completedTools || [],
      ...data,
    };

    const statusFields = [
      {
        type: "mrkdwn" as const,
        text: "*Current Status:*\n✅ Completed Successfully",
      },
      {
        type: "mrkdwn" as const,
        text: "*Agent State:*\n🤖 Task Finished",
      },
      {
        type: "mrkdwn" as const,
        text: "*Final Status:*\n✨ Success",
      },
      {
        type: "mrkdwn" as const,
        text: `*Started:*\n${taskData.startedAt}`,
      },
      {
        type: "mrkdwn" as const,
        text: `*Duration:*\n${taskData.elapsed}`,
      },
    ];

    return this.renderTaskBlocks(taskId, taskData, statusFields);
  }

  renderTaskFailure(
    taskId: number,
    errorMessage?: string,
    errorDetails?: string,
    data?: TaskDisplayData,
  ): AnyBlock[] {
    const taskData = {
      errorMessage: errorMessage || "Task execution failed due to an error",
      errorDetails,
      status: "Failed",
      userQuery: data?.userQuery || "Task execution encountered an error",
      startedAt: data?.startedAt || "Recently",
      elapsed: data?.elapsed || "Failed during execution",
      ...data,
    };

    const statusFields = [
      {
        type: "mrkdwn" as const,
        text: "*Current Status:*\n🔴 Failed",
      },
      {
        type: "mrkdwn" as const,
        text: "*Agent State:*\n🤖 Error",
      },
      {
        type: "mrkdwn" as const,
        text: "*Final Status:*\n💥 Execution Failed",
      },
      {
        type: "mrkdwn" as const,
        text: `*Started:*\n${taskData.startedAt}`,
      },
      {
        type: "mrkdwn" as const,
        text: `*Failed At:*\n${taskData.elapsed}`,
      },
    ];

    return this.renderTaskBlocks(taskId, taskData, statusFields);
  }

  renderTaskPendingTool(
    taskId: number,
    pendingTool?: string,
    toolDescription?: string,
    data?: TaskDisplayData,
  ): AnyBlock[] {
    const taskData = {
      currentTool: pendingTool || "awaiting_input",
      currentOperation:
        toolDescription || "Task is waiting for user input to continue",
      status: "Awaiting Input",
      userQuery: data?.userQuery || "Task is paused for user input",
      startedAt: data?.startedAt || "Recently",
      elapsed: data?.elapsed || "Paused for input",
      ...data,
    };

    const statusFields = [
      {
        type: "mrkdwn" as const,
        text: "*Current Status:*\n🟡 Processing",
      },
      {
        type: "mrkdwn" as const,
        text: "*Agent State:*\n🤖 Working",
      },
      {
        type: "mrkdwn" as const,
        text: `*Pending Tool:*\n⏳ ${pendingTool || "user_input"}`,
      },
      {
        type: "mrkdwn" as const,
        text: `*Started:*\n${taskData.startedAt}`,
      },
      {
        type: "mrkdwn" as const,
        text: `*Paused At:*\n${taskData.elapsed}`,
      },
    ];

    return this.renderTaskBlocks(taskId, taskData, statusFields);
  }

  renderTaskPendingInput(taskId: number, data?: TaskDisplayData): AnyBlock[] {
    const taskData = {
      status: "⏸️ Paused",
      userQuery: data?.userQuery || "Task is waiting for user input",
      startedAt: data?.startedAt || "Recently",
      elapsed: data?.elapsed || "Paused for user input",
      currentOperation: "Task paused - User input required in VSCode",
      ...data,
    };

    const statusFields = [
      {
        type: "mrkdwn" as const,
        text: "*Current Status:*\n⏸️ Paused for Input",
      },
      {
        type: "mrkdwn" as const,
        text: "*Agent State:*\n🛑 Waiting",
      },
      {
        type: "mrkdwn" as const,
        text: "*Next Action:*\n👤 User Input Required",
      },
      {
        type: "mrkdwn" as const,
        text: `*Started:*\n${taskData.startedAt}`,
      },
      {
        type: "mrkdwn" as const,
        text: `*Paused At:*\n${taskData.elapsed}`,
      },
    ];

    const blocks = this.renderTaskBlocks(taskId, taskData, statusFields, false);

    // Add special call-to-action for VSCode
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*🚨 Action Required:*\nThe AI agent needs your input to continue. Please switch to VSCode to provide the required information.",
      },
    });

    // Add prominent VSCode button
    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            emoji: true,
            text: "Continue in VSCode",
          },
          url: `vscode://TabbyML.pochi/?task=${taskId}`,
          style: "primary",
          value: "resume_in_vscode",
        },
      ],
    });

    return blocks;
  }

  renderErrorMessage(message: string) {
    return {
      type: "section" as const,
      text: {
        type: "mrkdwn" as const,
        text: `❌ *Error*\n${message}`,
      },
    };
  }
}

export const slackRichTextRenderer = new SlackRichTextRenderer();
