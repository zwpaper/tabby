import type { AnyBlock } from "@slack/web-api";

class SlackRichTextRenderer {
  renderTaskCreated(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
  ): AnyBlock[] {
    return [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🟢 Initializing* • Started at ${new Date().toLocaleTimeString()}`,
        },
      },
    ];
  }

  renderTaskStarting(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    todos?: Array<{ content: string; status: string }>,
    isLocal?: boolean,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*🟢 I'm gonna starting the task right now*",
        },
      },
    ];

    if (todos && todos.length > 0) {
      const todoText = todos
        .map((todo) => {
          if (todo.status === "completed") {
            return `• ~${todo.content}~`;
          }
          return `• ${todo.content}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 I will follow these steps to complete this task:*\n${todoText}`,
        },
      });
    }

    if (isLocal) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `🔗 *Open in VS Code:* \`vscode://TabbyML.pochi/?task=${taskId}\``,
        },
      });
    } else {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "📄 View Task Details",
            },
            url: `https://app.getpochi.com/tasks/${taskId}`,
            style: "primary",
          },
        ],
      });
    }

    return blocks;
  }

  renderTaskRunning(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    toolDescription: string,
    todos?: Array<{ content: string; status: string }>,
    completedTools?: string[],
    currentTool?: string,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🟡 Running:* ${toolDescription}`,
        },
      },
    ];

    if (todos && todos.length > 0) {
      const todoText = todos
        .map((todo) => {
          if (todo.status === "completed") {
            return `• ~${todo.content}~`;
          }
          return `• ${todo.content}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Here's my progress on the task steps:*\n${todoText}`,
        },
      });
    }

    this.renderCompletedToolsBlock(blocks, completedTools, currentTool);
    blocks.push(this.renderFooterBlock(taskId));

    return blocks;
  }

  renderTaskWaitingInput(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    waitingReason: string,
    todos?: Array<{ content: string; status: string }>,
    completedTools?: string[],
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*⏸️ Pending*\n\n\`${waitingReason}\``,
        },
      },
    ];

    if (todos && todos.length > 0) {
      const todoText = todos
        .map((todo) => {
          if (todo.status === "completed") {
            return `• ~${todo.content}~`;
          }
          return `• ${todo.content}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Current progress on my task steps:*\n${todoText}`,
        },
      });
    }

    this.renderCompletedToolsBlock(blocks, completedTools);

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 View Task Details",
          },
          url: `https://app.getpochi.com/tasks/${taskId}`,
          style: "primary",
        },
      ],
    });

    return blocks;
  }

  renderTaskComplete(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    result: string,
    todos?: Array<{ content: string; status: string }>,
    completedTools?: string[],
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*✅ Complete*\n*Result Generated:* Analysis completed successfully",
        },
      },
    ];

    if (todos && todos.length > 0) {
      const todoText = todos
        .map((todo) => {
          if (todo.status === "completed") {
            return `• ~${todo.content}~`;
          }
          return `• ${todo.content}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Task completion status:*\n${todoText}`,
        },
      });
    }

    // Truncate result if too long to avoid Slack character limit
    const maxLength = 2900;
    let displayResult = result;
    let needsMoreLink = false;

    if (result.length > maxLength) {
      displayResult = `${result.substring(0, maxLength)}...`;
      needsMoreLink = true;
    }

    const resultText = `*📋 Analysis Result:*\n${displayResult}${
      needsMoreLink
        ? `\n\n*<https://app.getpochi.com/tasks/${taskId}|More details on task page>*`
        : ""
    }`;

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: resultText,
      },
    });

    this.renderCompletedToolsBlock(blocks, completedTools);

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 View Task Details",
          },
          url: `https://app.getpochi.com/tasks/${taskId}`,
          style: "primary",
        },
      ],
    });

    return blocks;
  }

  renderTaskFailed(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
    taskId: string,
    errorMessage: string,
    todos?: Array<{ content: string; status: string }>,
    completedTools?: string[],
    failedTool?: string,
  ): AnyBlock[] {
    const blocks: AnyBlock[] = [
      this.renderHeaderBlock(prompt, githubRepository, slackUserId),
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*❌ Failed*\n*Error:* ${errorMessage}`,
        },
      },
    ];

    if (todos && todos.length > 0) {
      const todoText = todos
        .map((todo) => {
          if (todo.status === "completed") {
            return `• ~${todo.content}~`;
          }
          return `• ${todo.content}`;
        })
        .join("\n");

      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*📝 Task progress when error occurred:*\n${todoText}`,
        },
      });
    }

    this.renderCompletedToolsBlock(
      blocks,
      completedTools,
      undefined,
      failedTool,
    );

    blocks.push({
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 View Task Details",
          },
          url: `https://app.getpochi.com/tasks/${taskId}`,
          style: "primary",
        },
      ],
    });

    return blocks;
  }

  /**
   * Extract header from existing Slack message blocks
   */
  extractHeaderFromBlocks(blocks: AnyBlock[]): AnyBlock | null {
    return (
      blocks.find(
        (block) =>
          block.type === "section" &&
          "text" in block &&
          block.text?.type === "mrkdwn" &&
          typeof block.text.text === "string" &&
          block.text.text.includes(":wave: Oh! I just received a task"),
      ) || null
    );
  }

  /**
   * Extract footer (actions) from existing Slack message blocks
   */
  extractFooterFromBlocks(blocks: AnyBlock[]): AnyBlock | null {
    return (
      blocks.find(
        (block) =>
          block.type === "actions" &&
          "elements" in block &&
          Array.isArray(block.elements) &&
          block.elements.some(
            (element) =>
              "text" in element &&
              element.text &&
              typeof element.text === "object" &&
              "text" in element.text &&
              element.text.text === "📄 View Task Details",
          ),
      ) || null
    );
  }

  private renderHeaderBlock(
    prompt: string,
    githubRepository: { owner: string; repo: string },
    slackUserId: string,
  ): AnyBlock {
    return {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `:wave: Oh! I just received a task from <@${slackUserId}> about "${prompt}" for repository: <https://github.com/${githubRepository.owner}/${githubRepository.repo}|@${githubRepository.owner}/${githubRepository.repo}>. Let me investigate it...`,
      },
    };
  }

  private renderFooterBlock(taskId: string): AnyBlock {
    return {
      type: "actions",
      elements: [
        {
          type: "button",
          text: {
            type: "plain_text",
            text: "📄 View Task Details",
          },
          url: `https://app.getpochi.com/tasks/${taskId}`,
          style: "primary",
        },
      ],
    };
  }

  private renderCompletedToolsBlock(
    dst: AnyBlock[],
    completedTools?: string[],
    currentTool?: string,
    failedTool?: string,
  ) {
    if (!completedTools || completedTools.length === 0) {
      return;
    }

    const toolChain = completedTools.map((tool) => `${tool} ✅`).join(" → ");
    let additionalTool = "";

    if (currentTool) {
      additionalTool = ` → ${currentTool} 🔄`;
    } else if (failedTool) {
      additionalTool = ` → ${failedTool} ❌`;
    }

    dst.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `⚡ Completed tools: ${toolChain}${additionalTool}`,
        },
      ],
    });
  }

  /**
   * Parse header to extract repository and user information
   */
  parseHeaderInfo(headerBlock: AnyBlock): {
    githubRepository?: { owner: string; repo: string };
    slackUserId?: string;
    prompt?: string;
  } {
    if (
      headerBlock.type !== "section" ||
      !("text" in headerBlock) ||
      !headerBlock.text ||
      headerBlock.text.type !== "mrkdwn" ||
      typeof headerBlock.text.text !== "string"
    ) {
      return {};
    }

    const text = headerBlock.text.text;

    // Extract slack user ID
    const userMatch = text.match(/<@([^>]+)>/);
    const slackUserId = userMatch?.[1];

    // Extract prompt
    const promptMatch = text.match(/about "([^"]+)"/);
    const prompt = promptMatch?.[1];

    // Looking for pattern like: |@owner/repo>
    const repoMatch = text.match(/\|@([^/]+)\/([^>]+)>/);
    const githubRepository = repoMatch
      ? {
          owner: repoMatch[1],
          repo: repoMatch[2],
        }
      : undefined;

    return {
      githubRepository,
      slackUserId,
      prompt,
    };
  }
}

export const slackRichTextRenderer = new SlackRichTextRenderer();
